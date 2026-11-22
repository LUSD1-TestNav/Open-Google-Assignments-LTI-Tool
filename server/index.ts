import express, { Request, Response } from 'express';
import session from 'express-session';
import path from 'path';
import mongoose from 'mongoose';
import { google } from 'googleapis';
import { Provider as lti } from 'ltijs';
import { GoogleDriveService } from './drive/driveService';
import { ltiRouter } from './lti/ltiController';
import { AssignmentTemplate, StudentSubmission } from './models/schemas';

const app = express();
const driveService = new GoogleDriveService();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-this-secret-in-prod',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: true, sameSite: 'none' },
  })
);

// 1. Google OAuth2 Setup (Sole Auth & Storage Provider)
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

app.get('/auth/google', (req: Request, res: Response) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'openid',
      'email',
      'profile',
      DRIVE_FILE_SCOPE,
    ],
    prompt: 'consent',
  });
  res.redirect(url);
});


app.get('/auth/google/callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  const { tokens } = await oauth2Client.getToken(code as string);
  (req.session as any).googleTokens = tokens;

  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  (req.session as any).googleUser = userInfo.data;

  res.redirect('/app/launch');
});

app.get('/api/me', (req: Request, res: Response) => {
  const googleUser = (req.session as any).googleUser;
  if (!googleUser) return res.status(401).json({ needsGoogleAuth: true });
  res.json(googleUser);
});

// 2. Persistent Teacher Deep Linking Setup
app.post('/api/teacher/deep-link', async (req: Request, res: Response) => {
  const { idToken, assignmentTitle, templateFileId, maxPoints } = req.body;
  const googleUser = (req.session as any).googleUser;
  const assignmentKey = `asgn_${Date.now()}`;

  await AssignmentTemplate.create({
    assignmentKey,
    title: assignmentTitle,
    templateFileId: templateFileId || undefined,
    maxPoints: Number(maxPoints) || 100,
    teacherEmail: googleUser?.email,
  });

  const host = `${req.protocol}://${req.get('host')}`;
  const items = [
    {
      type: 'ltiResourceLink',
      title: assignmentTitle,
      url: `${host}/lti/launch?assignmentKey=${assignmentKey}`,
      lineItem: {
        scoreMaximum: Number(maxPoints) || 100,
        label: assignmentTitle,
        resourceId: assignmentKey,
      },
    },
  ];

  const formHtml = await lti.DeepLinking.createDeepLinkingMessage(idToken, items, {
    message: 'Assignment configured!',
  });
  res.send(formHtml);
});

// 3. Persistent Student Workspace (Clones Teacher Template Once, Creates/Attaches/Submits)
app.get('/api/student/workspace', async (req: Request, res: Response) => {
  const tokens = (req.session as any).googleTokens;
  const googleUser = (req.session as any).googleUser;
  if (!tokens) return res.status(401).json({ needsGoogleAuth: true });

  const { assignmentKey, studentId } = req.query as { assignmentKey: string; studentId: string };
  const config = await AssignmentTemplate.findOne({ assignmentKey });
  let submission = await StudentSubmission.findOne({ assignmentKey, studentId });

  if (config?.templateFileId && !submission) {
    const copy = await driveService.copyTemplateForStudent(
      tokens.access_token,
      config.templateFileId,
      `${config.title} - ${googleUser.name}`
    );

    submission = await StudentSubmission.create({
      assignmentKey,
      studentId,
      studentName: googleUser.name,
      studentEmail: googleUser.email,
      fileId: copy.id!,
      title: copy.name!,
      mimeType: copy.mimeType!,
      submitted: false,
    });
  }

  res.json({
    googleUser,
    accessToken: tokens.access_token,
    assignmentTitle: config?.title || 'Assignment',
    teacherEmail: config?.teacherEmail,
    submission,
  });
});

app.post('/api/student/create-file', async (req: Request, res: Response) => {
  const tokens = (req.session as any).googleTokens;
  const googleUser = (req.session as any).googleUser;
  const { assignmentKey, studentId, title, type } = req.body;

  const created = await driveService.createBlankFile(tokens.access_token, title, type);

  const submission = await StudentSubmission.findOneAndUpdate(
    { assignmentKey, studentId },
    {
      studentName: googleUser.name,
      studentEmail: googleUser.email,
      fileId: created.id!,
      title: created.name!,
      mimeType: created.mimeType!,
      submitted: false,
    },
    { upsert: true, new: true }
  );

  res.json(submission);
});

app.post('/api/student/attach-existing', async (req: Request, res: Response) => {
  const googleUser = (req.session as any).googleUser;
  const { assignmentKey, studentId, fileId, title, mimeType } = req.body;

  const submission = await StudentSubmission.findOneAndUpdate(
    { assignmentKey, studentId },
    {
      studentName: googleUser.name,
      studentEmail: googleUser.email,
      fileId,
      title,
      mimeType,
      submitted: false,
    },
    { upsert: true, new: true }
  );

  res.json(submission);
});

app.post('/api/student/submit', async (req: Request, res: Response) => {
  const tokens = (req.session as any).googleTokens;
  const { assignmentKey, studentId } = req.body;

  const config = await AssignmentTemplate.findOne({ assignmentKey });
  const sub = await StudentSubmission.findOne({ assignmentKey, studentId });
  if (!sub) return res.status(404).json({ error: 'No file attached to submit' });

  await driveService.lockAndShareForGrading(tokens.access_token, sub.fileId, config?.teacherEmail);

  sub.submitted = true;
  sub.submittedAt = new Date();
  await sub.save();

  res.json({ success: true, submission: sub });
});

// 4. SpeedGrader Lookup Endpoint (Fetches student submission & maxPoints for Teacher Grading View)
app.get('/api/grader/submission', async (req: Request, res: Response) => {
  const { assignmentKey, studentId } = req.query as { assignmentKey: string; studentId: string };
  const [config, submission] = await Promise.all([
    AssignmentTemplate.findOne({ assignmentKey }),
    StudentSubmission.findOne({ assignmentKey, studentId }),
  ]);

  if (!submission) return res.status(404).json({ error: 'Student has not created or submitted a file yet.' });

  res.json({
    submission,
    maxPoints: config?.maxPoints || 100,
    assignmentTitle: config?.title || 'Assignment',
  });
});

// 5. Mount LTI 1.3 Routes & Angular Frontend
app.use('/lti', ltiRouter);
app.use(express.static(path.join(__dirname, '../client/browser')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../client/browser/index.html'));
});


async function startServer() {
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/open-assignments';
  await mongoose.connect(mongoUrl);
  console.log('Connected to MongoDB');

  await lti.setup(
    process.env.LTI_KEY || 'LTI_ENCRYPTION_KEY_32_CHARS_MIN!',
    { url: mongoUrl },
    {
      appRoute: '/lti/launch',
      loginRoute: '/lti/login',
      keysetRoute: '/lti/keys',
      cookies: { secure: true, sameSite: 'None' },
    }
  );

  // Route LTI 1.3 Launches & Canvas SpeedGrader Submission Reviews
  lti.onConnect((token: any, req: Request, res: Response) => {
    const messageType = token.platformContext?.messageType;
    const assignmentKey = req.query.assignmentKey || '';

    // Canvas SpeedGrader opens via LtiSubmissionReviewRequest with target student ID in `forUser`
    if (messageType === 'LtiSubmissionReviewRequest') {
      const targetStudentId = token.platformContext?.forUser?.userId || '';
      return res.redirect(`/app/grader?assignmentKey=${assignmentKey}&studentId=${targetStudentId}`);
    }

    const roles: string[] = token.platformContext?.roles || [];
    const isInstructor = roles.some((r) => r.includes('Instructor') || r.includes('Administrator'));
    const view = isInstructor ? 'grader' : 'student';

    res.redirect(`/app/${view}?assignmentKey=${assignmentKey}&studentId=${token.user}`);
  });

  lti.onDeepLinking((_token: any, _req: Request, res: Response) => {
    res.redirect('/app/teacher-setup');
  });

  await lti.deploy({ serverless: true });
  app.use(lti.app);

  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Open Assignments LTI running on port ${port}`));
}

startServer();
