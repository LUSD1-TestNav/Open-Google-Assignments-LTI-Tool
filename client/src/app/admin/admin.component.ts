import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-admin',
  template: `
    <div style="max-width: 720px; margin: 32px auto; font-family: Roboto, sans-serif;">
      <!-- Google Login Gate -->
      <div *ngIf="needsGoogleAuth" style="text-align: center; padding: 48px; border: 1px solid #dadce0; border-radius: 8px;">
        <h2>Admin Portal — Sign in with Google</h2>
        <p style="color: #5f6368;">Sign in with your Google account to manage Canvas LTI 1.3 Client IDs and Secrets.</p>
        <a href="/auth/google"
           style="display: inline-block; padding: 12px 24px; background: #1a73e8; color: white; text-decoration: none; border-radius: 4px; font-weight: 500;">
          Sign in with Google
        </a>
      </div>

      <!-- Credential & Canvas Registration Form -->
      <div *ngIf="!needsGoogleAuth">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <h2 style="margin: 0;">Canvas LMS Integration & Credentials</h2>
          <span style="font-size: 13px; color: #5f6368;">Signed in: {{ userEmail }}</span>
        </div>

        <!-- Direct Configuration URLs Card -->
        <div style="padding: 20px; background: #f8f9fa; border: 1px solid #dadce0; border-radius: 8px; margin-bottom: 24px;">
          <h3 style="margin-top: 0; font-size: 16px;">Add Tool to Canvas by URL</h3>
          <p style="font-size: 14px; color: #5f6368;">
            Use the <strong>config.xml</strong> URL under <em>Course Settings &rarr; Apps &rarr; + App &rarr; By URL</em>,
            or the <strong>config.json</strong> URL under <em>Admin &rarr; Developer Keys &rarr; + LTI Key</em>.
          </p>

          <div style="margin-bottom: 12px;">
            <label style="display: block; font-size: 12px; font-weight: 600; color: #3c4043;">Direct XML Configuration URL (config.xml)</label>
            <div style="display: flex; gap: 8px; margin-top: 4px;">
              <input type="text" [value]="configXmlUrl" readonly
                     style="flex: 1; padding: 8px; border: 1px solid #dadce0; border-radius: 4px; background: #fff;" />
              <button (click)="copyText(configXmlUrl)"
                      style="padding: 8px 14px; background: #fff; border: 1px solid #dadce0; border-radius: 4px; cursor: pointer;">
                Copy XML URL
              </button>
            </div>
          </div>

          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #3c4043;">LTI 1.3 Developer Key URL (config.json)</label>
            <div style="display: flex; gap: 8px; margin-top: 4px;">
              <input type="text" [value]="configJsonUrl" readonly
                     style="flex: 1; padding: 8px; border: 1px solid #dadce0; border-radius: 4px; background: #fff;" />
              <button (click)="copyText(configJsonUrl)"
                      style="padding: 8px 14px; background: #fff; border: 1px solid #dadce0; border-radius: 4px; cursor: pointer;">
                Copy JSON URL
              </button>
            </div>
          </div>
        </div>

        <!-- Generate / Register Client ID & Secret -->
        <div style="padding: 20px; border: 1px solid #dadce0; border-radius: 8px;">
          <h3 style="margin-top: 0; font-size: 16px;">Generate or Link Client ID & Client Secret</h3>

          <div style="margin-bottom: 14px;">
            <label style="display: block; font-weight: 500; margin-bottom: 6px;">Canvas LMS Base URL</label>
            <input type="url" [(ngModel)]="canvasUrl" placeholder="https://instructure.com"
                   style="width: 100%; padding: 10px; border: 1px solid #dadce0; border-radius: 4px;" />
          </div>

          <div style="margin-bottom: 16px;">
            <label style="display: block; font-weight: 500; margin-bottom: 6px;">
              Canvas Developer Key Client ID <span style="font-weight: 400; color: #5f6368;">(Leave blank to auto-generate)</span>
            </label>
            <input type="text" [(ngModel)]="customClientId" placeholder="e.g., 10000000000042"
                   style="width: 100%; padding: 10px; border: 1px solid #dadce0; border-radius: 4px;" />
          </div>

          <button (click)="createCredentials()" [disabled]="!canvasUrl || loading"
                  style="padding: 10px 20px; background: #1a73e8; color: white; border: none; border-radius: 4px; font-weight: 500; cursor: pointer;">
            {{ loading ? 'Registering...' : 'Generate & Link Credentials' }}
          </button>

          <!-- Generated Credentials Output -->
          <div *ngIf="createdResult" style="margin-top: 20px; padding: 16px; background: #e6f4ea; border-radius: 6px; color: #137333;">
            <p style="margin-top: 0; font-weight: 600;">Canvas LMS Linked Successfully!</p>
            <p style="margin: 6px 0;"><strong>Client ID:</strong> <code>{{ createdResult.clientId }}</code></p>
            <p style="margin: 6px 0;"><strong>Client Secret:</strong> <code>{{ createdResult.clientSecret }}</code></p>
            <small>Save your Client Secret now—it will not be shown again.</small>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AdminComponent implements OnInit {
  needsGoogleAuth = false;
  userEmail = '';
  canvasUrl = 'https://instructure.com';
  customClientId = '';
  loading = false;
  createdResult: any = null;

  configXmlUrl = `${window.location.origin}/lti/config.xml`;
  configJsonUrl = `${window.location.origin}/lti/config.json`;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<any>('/api/me').subscribe({
      next: (user) => {
        this.needsGoogleAuth = false;
        this.userEmail = user.email;
      },
      error: (err) => {
        if (err.status === 401) this.needsGoogleAuth = true;
      },
    });
  }

  createCredentials() {
    this.loading = true;
    this.http
      .post<any>('/lti/admin/credentials', {
        canvasUrl: this.canvasUrl.replace(/\/$/, ''),
        customClientId: this.customClientId.trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.loading = false;
          this.createdResult = res;
        },
        error: () => {
          this.loading = false;
          alert('Failed to register Canvas platform. Check your URL and try again.');
        },
      });
  }

  copyText(val: string) {
    navigator.clipboard.writeText(val);
    alert('Copied to clipboard!');
  }
}
