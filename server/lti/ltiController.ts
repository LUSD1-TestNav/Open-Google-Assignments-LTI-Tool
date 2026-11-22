import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { Provider as lti } from 'ltijs';

export const ltiRouter = express.Router();

// 1. Direct URL for Canvas "By URL" Tool Configuration (/lti/config.xml)
ltiRouter.get('/config.xml', (req: Request, res: Response) => {
  const host = `${req.protocol}://${req.get('host')}`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cartridge_basiclti_link xmlns="http://imsglobal.org"
    xmlns:blti="http://imsglobal.org"
    xmlns:lticm="http://imsglobal.org"
    xmlns:lticp="http://imsglobal.org"
    xmlns:xsi="http://w3.org"
    xsi:schemaLocation="http://imsglobal.org http://imsglobal.org">
  <blti:title>Open Google Assignments LTI 1.3</blti:title>
  <blti:description>Create, distribute, preview, and grade Google Docs, Sheets, and Slides in Canvas.</blti:description>
  <blti:launch_url>${host}/lti/launch</blti:launch_url>
  <blti:extensions platform="://instructure.com">
    <lticm:property name="tool_id">open_google_assignments_1_3</lticm:property>
    <lticm:property name="privacy_level">public</lticm:property>
    <lticm:property name="domain">${req.get('host')}</lticm:property>
    <lticm:options name="assignment_selection">
      <lticm:property name="message_type">LtiDeepLinkingRequest</lticm:property>
      <lticm:property name="url">${host}/lti/launch</lticm:property>
    </lticm:options>
    <lticm:options name="submission_type_selection">
      <lticm:property name="message_type">LtiDeepLinkingRequest</lticm:property>
      <lticm:property name="url">${host}/lti/launch</lticm:property>
    </lticm:options>
  </blti:extensions>
</cartridge_basiclti_link>`;

  res.type('application/xml').send(xml);
});

// 2. Canvas LTI 1.3 JSON Configuration URL (/lti/config.json - Recommended for Canvas Developer Keys)
ltiRouter.get('/config.json', (req: Request, res: Response) => {
  const host = `${req.protocol}://${req.get('host')}`;
  res.json({
    title: 'Open Google Assignments LTI 1.3',
    scopes: [
      'https://imsglobal.org',
      'https://imsglobal.org',
      'https://imsglobal.org',
      'https://imsglobal.org',
    ],
    extensions: [
      {
        platform: '://instructure.com',
        privacy_level: 'public',
        settings: {
          placements: [
            {
              placement: 'assignment_selection',
              message_type: 'LtiDeepLinkingRequest',
              target_link_uri: `${host}/lti/launch`,
            },
            {
              placement: 'submission_type_selection',
              message_type: 'LtiDeepLinkingRequest',
              target_link_uri: `${host}/lti/launch`,
            },
          ],
        },
      },
    ],
    public_jwk_url: `${host}/lti/keys`,
    target_link_uri: `${host}/lti/launch`,
    oidc_initiation_url: `${host}/lti/login`,
  });
});

// 3. Portal Endpoint to Generate/Register Client IDs & Client Secrets
ltiRouter.post('/admin/credentials', async (req: Request, res: Response) => {
  const { canvasUrl, customClientId } = req.body;
  const generatedClientId = customClientId || `lti_${crypto.randomBytes(12).toString('hex')}`;
  const generatedClientSecret = crypto.randomBytes(32).toString('hex');

  await lti.registerPlatform({
    url: canvasUrl,
    name: 'Canvas LMS',
    clientId: generatedClientId,
    authenticationEndpoint: `${canvasUrl}/api/lti/authorize_redirect`,
    accesstokenEndpoint: `${canvasUrl}/login/oauth2/token`,
    authConfig: { method: 'JWK_SET', key: `${canvasUrl}/api/lti/security/jwks` },
  });

  res.json({
    clientId: generatedClientId,
    clientSecret: generatedClientSecret,
    configXmlUrl: `${req.protocol}://${req.get('host')}/lti/config.xml`,
    configJsonUrl: `${req.protocol}://${req.get('host')}/lti/config.json`,
  });
});

// 4. Submit Grade Back to Canvas SpeedGrader via LTI AGS
ltiRouter.post('/grade', async (req: Request, res: Response) => {
  const { idToken, studentUserId, scoreGiven, scoreMaximum, comment } = req.body;

  const scoreObj = {
    userId: studentUserId,
    scoreGiven: Number(scoreGiven),
    scoreMaximum: Number(scoreMaximum),
    comment: comment || '',
    timestamp: new Date().toISOString(),
    activityProgress: 'Completed',
    gradingProgress: 'FullyGraded',
  };

  // Sends grade directly to Canvas Gradebook & SpeedGrader
  const response = await lti.Grade.submitScore(idToken, scoreObj);
  res.json({ success: true, response });
});
