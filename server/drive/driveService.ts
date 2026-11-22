import { google } from 'googleapis';

export class GoogleDriveService {
  private getOAuthClient(accessToken: string) {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    auth.setCredentials({ access_token: accessToken });
    return auth;
  }

  // 1. Create a new Google Doc, Sheet, or Slide for a Student
  async createBlankFile(accessToken: string, title: string, type: 'doc' | 'sheet' | 'slide') {
    const mimeMap = {
      doc: 'application/vnd.google-apps.document',
      sheet: 'application/vnd.google-apps.spreadsheet',
      slide: 'application/vnd.google-apps.presentation',
    };

    const drive = google.drive({ version: 'v3', auth: this.getOAuthClient(accessToken) });
    const res = await drive.files.create({
      requestBody: {
        name: title,
        mimeType: mimeMap[type],
      },
      fields: 'id, name, webViewLink, mimeType',
    });
    return res.data;
  }

  // 2. Make a Student Copy of a Teacher's Template File
  async copyTemplateForStudent(accessToken: string, templateFileId: string, newTitle: string) {
    const drive = google.drive({ version: 'v3', auth: this.getOAuthClient(accessToken) });
    const copy = await drive.files.copy({
      fileId: templateFileId,
      requestBody: { name: newTitle },
      fields: 'id, name, webViewLink, mimeType',
    });
    return copy.data;
  }

  // 3. Share Submitted File with Teacher / Domain for Live Preview in SpeedGrader
  async lockAndShareForGrading(accessToken: string, fileId: string, teacherEmail?: string) {
    const drive = google.drive({ version: 'v3', auth: this.getOAuthClient(accessToken) });
    if (teacherEmail) {
      await drive.permissions.create({
        fileId,
        requestBody: {
          role: 'commenter', // Allows teacher to comment/grade without altering student text
          type: 'user',
          emailAddress: teacherEmail,
        },
      });
    }
    return `https://google.com{fileId}/preview`;
  }
}
