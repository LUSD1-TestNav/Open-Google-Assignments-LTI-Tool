import { Component, Input, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-grader-view',
  template: `
    <div class="grader-layout" style="display: flex; height: 100vh;">
      <!-- Left Pane: Live Google Drive Document / Sheet / Slide Preview -->
      <div class="preview-pane" style="flex: 3; border-right: 1px solid #ddd;">
        <iframe
          *ngIf="safePreviewUrl"
          [src]="safePreviewUrl"
          width="100%"
          height="100%"
          frameborder="0"
          allowfullscreen>
        </iframe>
      </div>

      <!-- Right Pane: SpeedGrader Score & Feedback -->
      <div class="grading-pane" style="flex: 1; padding: 20px; background: #fafafa;">
        <h3>Grade Submission</h3>
        <p><strong>Student:</strong> {{ studentName }}</p>

        <label>Score (out of {{ maxPoints }}):</label>
        <input type="number" [(ngModel)]="score" [max]="maxPoints" min="0" style="width: 100%; margin-bottom: 12px;" />

        <label>Feedback Comment:</label>
        <textarea [(ngModel)]="feedback" rows="5" style="width: 100%; margin-bottom: 12px;"></textarea>

        <button (click)="submitGradeToCanvas()" [disabled]="saving" style="width: 100%; padding: 10px; background: #1a73e8; color: white; border: none; cursor: pointer;">
          {{ saving ? 'Syncing with Canvas...' : 'Return & Sync to SpeedGrader' }}
        </button>

        <p *ngIf="statusMessage" style="color: green; margin-top: 10px;">{{ statusMessage }}</p>
      </div>
    </div>
  `
})
export class GraderViewComponent implements OnInit {
  @Input() fileId!: string;
  @Input() studentUserId!: string;
  @Input() studentName!: string;
  @Input() maxPoints = 100;
  @Input() idToken!: string;

  safePreviewUrl?: SafeResourceUrl;
  score = 0;
  feedback = '';
  saving = false;
  statusMessage = '';

  constructor(private sanitizer: DomSanitizer, private http: HttpClient) {}

  ngOnInit() {
    const rawUrl = `https://google.com{this.fileId}/preview`;
    this.safePreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(rawUrl);
  }

  submitGradeToCanvas() {
    this.saving = true;
    this.http.post('/lti/grade', {
      idToken: this.idToken,
      studentUserId: this.studentUserId,
      scoreGiven: this.score,
      scoreMaximum: this.maxPoints,
      comment: this.feedback
    }).subscribe({
      next: () => {
        this.saving = false;
        this.statusMessage = 'Grade synced to Canvas SpeedGrader!';
      },
      error: () => {
        this.saving = false;
        this.statusMessage = 'Error syncing grade.';
      }
    });
  }
}
