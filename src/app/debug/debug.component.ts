import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-debug',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Debug Console</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-list>
        <ion-item>
          <ion-button (click)="testBackend()"
            >Test Backend Connection</ion-button
          >
        </ion-item>
        <ion-item>
          <ion-button (click)="testLogin()">Test Login</ion-button>
        </ion-item>
        <ion-item>
          <ion-button (click)="testRegister()">Test Register</ion-button>
        </ion-item>
        <ion-item>
          <ion-button (click)="clearLog()">Clear Log</ion-button>
        </ion-item>
      </ion-list>

      <ion-card>
        <ion-card-header>
          <ion-card-title>Debug Log</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <pre>{{ debugLog }}</pre>
        </ion-card-content>
      </ion-card>
    </ion-content>
  `,
})
export class DebugComponent {
  debugLog = '';

  constructor(private http: HttpClient) {}

  log(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    this.debugLog += `[${timestamp}] ${message}\n`;
    console.log(message);
  }

  testBackend() {
    this.log('🔍 Testing backend connection...');

    this.http.get('/backend/test-cors.php').subscribe({
      next: (response) => {
        this.log(
          '✅ Backend connection successful: ' + JSON.stringify(response)
        );
      },
      error: (error) => {
        this.log('❌ Backend connection failed: ' + JSON.stringify(error));
        this.log('Status: ' + error.status);
        this.log('Message: ' + error.message);
        this.log('URL: ' + error.url);
      },
    });
  }

  testLogin() {
    this.log('🔍 Testing login...');

    this.http
      .post('/backend/login.php', {
        username: 'testuser',
        password: 'testpass',
      })
      .subscribe({
        next: (response) => {
          this.log('✅ Login test response: ' + JSON.stringify(response));
        },
        error: (error) => {
          this.log('❌ Login test failed: ' + JSON.stringify(error));
          this.log('Status: ' + error.status);
          this.log('Message: ' + error.message);
        },
      });
  }

  testRegister() {
    this.log('🔍 Testing register...');

    this.http
      .post('/backend/register.php', {
        username: 'testuser' + Date.now(),
        password: 'testpass',
      })
      .subscribe({
        next: (response) => {
          this.log('✅ Register test response: ' + JSON.stringify(response));
        },
        error: (error) => {
          this.log('❌ Register test failed: ' + JSON.stringify(error));
          this.log('Status: ' + error.status);
          this.log('Message: ' + error.message);
        },
      });
  }

  clearLog() {
    this.debugLog = '';
  }
}
