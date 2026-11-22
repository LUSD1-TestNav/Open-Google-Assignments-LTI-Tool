import { Component, Input } from '@angular/core';
import { HttpClient } from '@angular/common/http';

declare const google: any;
declare const gapi: any;

@Component({
  selector: 'app-teacher-setup',
  template: `
    <div style="max-width: 640px; margin: 32px auto; font-family: Roboto, sans-serif;">
      <h2>Create Google Drive Assignment</h2>
      <p style="color: #5f6368;">Each student will automatically receive their own personal copy of your attached file.</p>

      <div style="margin-bottom: 16px;">
        <label style="display: block; font-weight: 500; margin-bottom: 6px;">Assignment Title</label>
        <input type="text" [(ngModel)]="assignmentTitle" placeholder="e.g., Unit 3 Lab Report"
               style="width: 100%; padding: 10px; border: 1px solid #dadce0; border-radius: 4px;" />
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; font-weight: 500; margin-bottom: 6px;">Points Possible</label>
        <input type="number" [(ngModel)]="maxPoints"
               style="width: 100%; padding: 10px; border: 1px solid #dadce0; border-radius: 4px;" />
      </div>

      <div style="margin-bottom: 20px; padding: 16px; border: 1px dashed #1a73e8; border-radius: 8px; background: #f8f9fa;">
        <button (click)="openGoogleDrivePicker()"
                style="padding: 10px 16px; background: #fff; border: 1px solid #dadce0; border-radius: 4px; cursor: pointer; font-weight: 500;">
          Attach Template from Google Drive (Doc, Sheet, or Slide)
        </button>

        <div *ngIf="selectedTemplateName" style="margin-top: 12px; color: #188038; font-weight: 500;">
          Attached Template: {{ selectedTemplateName }} (Each student gets a copy)
        </div>
      </div>

      <button (click)="saveAndLinkToCanvas()" [disabled]="!assignmentTitle || submitting"
              style="width: 100%; padding: 12px; background: #1a73e8; color: white; border: none; border-radius: 4px; font-size: 15px; cursor: pointer;">
        {{ submitting ? 'Linking to Canvas...' : 'Create & Link Assignment' }}
      </button>
    </div>
  `,
})
export class TeacherSetupComponent {
  @Input() idToken!: string;
  @Input() googleAccessToken!: string;
  @Input() googleApiKey!: string;

  assignmentTitle = '';
  maxPoints = 100;
  selectedTemplateId = '';
  selectedTemplateName = '';
  submitting = false;

  constructor(private http: HttpClient) {}

  openGoogleDrivePicker() {
    gapi.load('picker', () => {
      const docsView = new google.picker.DocsView()
        .setIncludeFolders(true)
        .setMimeTypes(
          'application/vnd.google-apps.document,application/vnd.google-apps.spreadsheet,application/vnd.google-apps.presentation'
        );

      const picker = new google.picker.PickerBuilder()
        .addView(docsView)
        .setOAuthToken(this.googleAccessToken)
        .setDeveloperKey(this.googleApiKey)
        .setCallback((data: any) => {
          if (data.action === google.picker.Action.PICKED) {
            const doc = data.docs[0];
            this.selectedTemplateId = doc.id;
            this.selectedTemplateName = doc.name;
          }
        })
        .build();
      picker.setVisible(true);
    });
  }

  saveAndLinkToCanvas() {
    this.submitting = true;
    this.http
      .post(
        '/api/teacher/deep-link',
        {
          idToken: this.idToken,
          assignmentTitle: this.assignmentTitle,
          templateFileId: this.selectedTemplateId,
          maxPoints: this.maxPoints,
        },
        { responseType: 'text' }
      )
      .subscribe((autoSubmitHtmlForm) => {
        // Renders the signed LTI Deep Linking response form that sends the assignment back to Canvas
        document.open();
        document.write(autoSubmitHtmlForm);
        document.close();
      });
  }
}
