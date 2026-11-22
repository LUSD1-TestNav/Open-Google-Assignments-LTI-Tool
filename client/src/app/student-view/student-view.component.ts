import { Component, Input, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

declare const google: any;
declare const gapi: any;

@Component({
  selector: 'app-student-view',
  template: `
    <div style="max-width: 900px; margin: 24px auto; font-family: Roboto, sans-serif;">
      <!-- Google Login Gate -->
      <div *ngIf="needsGoogleAuth" style="text-align: center; padding: 48px; border: 1px solid #dadce0; border-radius: 8px;">
        <h2>Connect Your Google Account</h2>
        <p>Sign in with Google to create, edit, and submit Docs, Sheets, and Slides.</p>
        <a href="/auth/google"
           style="display: inline-block; padding: 12px 24px; background: #1a73e8; color: white; text-decoration: none; border-radius: 4px; font-weight: 500;">
          Sign in with Google
        </a>
      </div>

      <!-- Active Assignment Workspace -->
      <div *ngIf="!needsGoogleAuth">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h2 style="margin: 0;">{{ assignmentTitle }}</h2>
            <small style="color: #5f6368;">Signed in as {{ googleUser?.email }}</small>
          </div>

          <span *ngIf="submission?.submitted"
                style="padding: 6px 12px; background: #e6f4ea; color: #137333; border-radius: 16px; font-weight: 500;">
            Submitted
          </span>
        </div>

        <!-- Create or Attach Toolbar (Shown if no file is attached yet) -->
        <div *ngIf="!submission" style="padding: 24px; border: 1px solid #dadce0; border-radius: 8px; background: #f8f9fa;">
          <h4 style="margin-top: 0;">Your Work</h4>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button (click)="createNew('doc')" style="padding: 10px 14px; background: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer;">
              + Create Google Doc
            </button>
            <button (click)="createNew('sheet')" style="padding: 10px 14px; background: #0f9d58; color: white; border: none; border-radius: 4px; cursor: pointer;">
              + Create Google Sheet
            </button>
            <button (click)="createNew('slide')" style="padding: 10px 14px; background: #f4b400; color: #202124; border: none; border-radius: 4px; cursor: pointer;">
              + Create Google Slide
            </button>
            <button (click)="attachFromDrive()" style="padding: 10px 14px; background: white; border: 1px solid #dadce0; border-radius: 4px; cursor: pointer;">
              Attach from Google Drive
            </button>
          </div>
        </div>

        <!-- Attached / Cloned File Card + Live Preview -->
        <div *ngIf="submission" style="border: 1px solid #dadce0; border-radius: 8px; overflow: hidden;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #f1f3f4;">
            <strong>{{ submission.title }}</strong>
            <div style="display: flex; gap: 10px;">
              <a [href]="'https://google.com' + submission.fileId" target="_blank"
                 style="padding: 8px 14px; background: white; border: 1px solid #dadce0; border-radius: 4px; text-decoration: none; color: #1a73e8; font-weight: 500;">
                Open & Edit in Google
              </a>
              <button (click)="submitAssignment()" [disabled]="submission.submitted || submitting"
                      style="padding: 8px 18px; background: #1a73e8; color: white; border: none; border-radius: 4px; font-weight: 500; cursor: pointer;">
                {{ submission.submitted ? 'Submitted' : (submitting ? 'Submitting...' : 'Submit Assignment') }}
              </button>
            </div>
          </div>

          <!-- Live Document Preview -->
          <iframe *ngIf="previewUrl" [src]="previewUrl" width="100%" height="600px" frameborder="0"></iframe>
        </div>
      </div>
    </div>
  `,
})
export class StudentViewComponent implements OnInit {
  @Input() assignmentKey!: string;
  @Input() studentId!: string;
  @Input() teacherEmail?: string;
  @Input() googleApiKey!: string;

  needsGoogleAuth = false;
  googleUser: any;
  accessToken = '';
  assignmentTitle = '';
  submission: any = null;
  previewUrl?: SafeResourceUrl;
  submitting = false;

  constructor(private http: HttpClient, private sanitizer: DomSanitizer) {}

  ngOnInit() {
    this.loadWorkspace();
  }

  loadWorkspace() {
    this.http
      .get<any>(`/api/student/workspace?assignmentKey=${this.assignmentKey}&studentId=${this.studentId}`)
      .subscribe({
        next: (data) => {
          this.needsGoogleAuth = false;
          this.googleUser = data.googleUser;
          this.accessToken = data.accessToken;
          this.assignmentTitle = data.assignmentTitle;
          if (data.submission) {
            this.setSubmission(data.submission);
          }
        },
        error: (err) => {
          if (err.status === 401) this.needsGoogleAuth = true;
        },
      });
  }

  setSubmission(sub: any) {
    this.submission = sub;
    this.previewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://google.com{sub.fileId}/preview`
    );
  }

  createNew(type: 'doc' | 'sheet' | 'slide') {
    this.http
      .post<any>('/api/student/create-file', {
        assignmentKey: this.assignmentKey,
        studentId: this.studentId,
        title: `${this.assignmentTitle} - ${this.googleUser.name}`,
        type,
      })
      .subscribe((sub) => this.setSubmission(sub));
  }

  attachFromDrive() {
    gapi.load('picker', () => {
      const picker = new google.picker.PickerBuilder()
        .addView(google.picker.ViewId.DOCS)
        .setOAuthToken(this.accessToken)
        .setDeveloperKey(this.googleApiKey)
        .setCallback((data: any) => {
          if (data.action === google.picker.Action.PICKED) {
            const doc = data.docs[0];
            this.http
              .post<any>('/api/student/attach-existing', {
                assignmentKey: this.assignmentKey,
                studentId: this.studentId,
                fileId: doc.id,
                title: doc.name,
                mimeType: doc.mimeType,
              })
              .subscribe((sub) => this.setSubmission(sub));
          }
        })
        .build();
      picker.setVisible(true);
    });
  }

  submitAssignment() {
    this.submitting = true;
    this.http
      .post<any>('/api/student/submit', {
        assignmentKey: this.assignmentKey,
        studentId: this.studentId,
        teacherEmail: this.teacherEmail,
      })
      .subscribe((res) => {
        this.submitting = false;
        this.submission = res.submission;
      });
  }
}
