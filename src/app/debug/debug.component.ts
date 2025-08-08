import { Component, OnInit } from '@angular/core';
import { FirebaseTestService, FirebaseTestResult } from '../services/firebase-test.service';
import { FirebaseAdminService } from '../services/firebase-admin.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-debug',
  template: `
    <ion-content>
      <ion-header>
        <ion-toolbar class="custom-toolbar">
          <ion-title class="custom-title">Firebase Debug & Diagnose</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-list>
        <ion-item>
          <ion-label>
            <h2>Firebase Diagnose</h2>
            <p>Testet die Firebase-Konfiguration und Verbindung</p>
          </ion-label>
          <ion-button slot="end" (click)="runDiagnostic()" [disabled]="loading">
            {{ loading ? 'Teste...' : 'Diagnose starten' }}
          </ion-button>
        </ion-item>

        <ion-item *ngIf="diagnosticResults.length > 0">
          <ion-label>
            <h2>Diagnose-Ergebnisse</h2>
          </ion-label>
        </ion-item>

        <ion-item *ngFor="let result of diagnosticResults" [color]="result.success ? 'success' : 'danger'">
          <ion-label>
            <h3>{{ result.success ? '✅' : '❌' }} {{ result.message }}</h3>
            <p *ngIf="result.details">
              <strong>Details:</strong> {{ result.details | json }}
            </p>
            <div *ngIf="result.recommendations && result.recommendations.length > 0">
              <strong>Empfehlungen:</strong>
              <ul>
                <li *ngFor="let rec of result.recommendations">{{ rec }}</li>
              </ul>
            </div>
          </ion-label>
        </ion-item>

        <ion-item>
          <ion-label>
            <h2>Einfacher Login-Test</h2>
            <p>Testet die Registrierung und Anmeldung</p>
          </ion-label>
          <ion-button slot="end" (click)="testAuth()" [disabled]="authLoading">
            {{ authLoading ? 'Teste...' : 'Auth testen' }}
          </ion-button>
        </ion-item>

        <ion-item *ngIf="authResult">
          <ion-label>
            <h3>{{ authResult.success ? '✅' : '❌' }} {{ authResult.message }}</h3>
            <p *ngIf="authResult.user">
              <strong>User:</strong> {{ authResult.user.username }} ({{ authResult.user.email }})
            </p>
          </ion-label>
        </ion-item>

        <ion-item>
          <ion-label>
            <h2>Design-Test</h2>
            <p>Testet das neue Design</p>
          </ion-label>
          <ion-button slot="end" (click)="showDesignTest = !showDesignTest">
            {{ showDesignTest ? 'Verstecken' : 'Anzeigen' }}
          </ion-button>
        </ion-item>

        <ion-item *ngIf="showDesignTest">
          <ion-label>
            <h2>Design-Test Formular</h2>
            <form [formGroup]="testForm" (ngSubmit)="onTestSubmit()">
              <ion-item class="custom-item">
                <ion-label position="stacked" class="custom-label">Test E-Mail/Benutzername</ion-label>
                <ion-input
                  formControlName="emailOrUsername"
                  placeholder="test@example.com oder testuser"
                  class="custom-input"
                ></ion-input>
              </ion-item>

              <ion-item class="custom-item">
                <ion-label position="stacked" class="custom-label">Test Passwort</ion-label>
                <ion-input
                  type="password"
                  formControlName="password"
                  placeholder="Testpasswort"
                  class="custom-input"
                ></ion-input>
              </ion-item>

              <ion-button
                expand="block"
                type="submit"
                [disabled]="!testForm.valid"
                class="custom-button"
              >
                Test Login
              </ion-button>
            </form>
          </ion-label>
        </ion-item>

        <ion-item *ngIf="testResult">
          <ion-label>
            <h3>{{ testResult.success ? '✅' : '❌' }} {{ testResult.message }}</h3>
          </ion-label>
        </ion-item>

        <ion-item>
          <ion-label>
            <h2>Konfiguration anzeigen</h2>
            <p>Zeigt die aktuelle Firebase-Konfiguration</p>
          </ion-label>
          <ion-button slot="end" (click)="showConfig()">
            Konfiguration anzeigen
          </ion-button>
        </ion-item>

        <ion-item *ngIf="showConfigData">
          <ion-label>
            <h3>Firebase Konfiguration:</h3>
            <pre>{{ configData | json }}</pre>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
  styles: [`
    pre {
      background: #f4f4f4;
      padding: 10px;
      border-radius: 4px;
      font-size: 12px;
      overflow-x: auto;
    }
    
    ul {
      margin: 5px 0;
      padding-left: 20px;
    }
    
    li {
      margin: 2px 0;
    }

    // Custom Design Variablen
    :root {
      --primary: #30eb7e;
      --secondary-navy: #1a1a2e;
      --secondary-white: #ffffff;
      --secondary-midgray: #888888;
      --secondary-lightgray: #f8f9fa;
      --status-negative: #ff4757;
      --status-positive: #2ed573;
    }

    .custom-toolbar {
      --background: var(--primary);
      --color: var(--secondary-white);
    }

    .custom-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--secondary-white);
    }

    .custom-item {
      margin: 10px 0;
      border-radius: 10px;
      --border-radius: 10px;
      --background: var(--secondary-navy);
      --border-color: var(--secondary-midgray);
      --highlight-color: var(--primary);
      --inner-background: var(--secondary-navy);
      --inner-border-color: var(--secondary-midgray);
    }

    .custom-label {
      font-weight: 500;
      color: var(--secondary-white);
      margin-bottom: 5px;
    }

    .custom-input {
      --padding-start: 15px;
      --padding-end: 15px;
      --padding-top: 12px;
      --padding-bottom: 12px;
      --background: var(--secondary-navy);
      --color: var(--secondary-white);
      --placeholder-color: var(--secondary-midgray);
      font-size: 16px;
    }

    .custom-button {
      margin: 20px 0 10px 0;
      --background: var(--primary);
      --border-radius: 10px;
      --box-shadow: 0 4px 15px rgba(48, 235, 126, 0.4);
      font-weight: 600;
      height: 50px;
    }

    .custom-button:disabled {
      --background: #6c757d;
      --box-shadow: none;
    }
  `]
})
export class DebugComponent implements OnInit {
  loading = false;
  authLoading = false;
  diagnosticResults: FirebaseTestResult[] = [];
  authResult: any = null;
  showConfigData = false;
  configData: any = null;
  showDesignTest = false;
  testForm: FormGroup;
  testResult: any = null;

  constructor(
    private firebaseTestService: FirebaseTestService,
    private firebaseAdminService: FirebaseAdminService,
    private fb: FormBuilder
  ) { 
    this.testForm = this.fb.group({
      emailOrUsername: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });
  }

  ngOnInit() {
    // Automatische Diagnose beim Laden
    this.runDiagnostic();
  }

  async runDiagnostic() {
    this.loading = true;
    this.diagnosticResults = [];
    
    try {
      // Logge Diagnose-Informationen
      this.firebaseTestService.logDiagnosticInfo();
      
      // Führe vollständige Diagnose durch
      this.diagnosticResults = await this.firebaseTestService.runFullDiagnostic();
      
      console.log('Diagnose-Ergebnisse:', this.diagnosticResults);
    } catch (error: any) {
      console.error('Diagnose fehlgeschlagen:', error);
      this.diagnosticResults.push({
        success: false,
        message: 'Diagnose fehlgeschlagen: ' + (error?.message || 'Unbekannter Fehler')
      });
    } finally {
      this.loading = false;
    }
  }

  async testAuth() {
    this.authLoading = true;
    this.authResult = null;
    
    try {
      // Teste Registrierung
      const testEmail = `test_${Date.now()}@example.com`;
      const testPassword = 'TestPassword123!';
      const testUsername = `testuser_${Date.now()}`;
      
      console.log('Teste Firebase Auth mit:', { testEmail, testUsername });
      
      const result = await this.firebaseAdminService.register(testEmail, testPassword, testUsername);
      
      this.authResult = result;
      
      if (result.success) {
        console.log('Auth-Test erfolgreich:', result);
      } else {
        console.error('Auth-Test fehlgeschlagen:', result);
      }
      
    } catch (error: any) {
      console.error('Auth-Test fehlgeschlagen:', error);
      this.authResult = {
        success: false,
        message: 'Auth-Test fehlgeschlagen: ' + (error?.message || 'Unbekannter Fehler')
      };
    } finally {
      this.authLoading = false;
    }
  }

  async onTestSubmit() {
    if (this.testForm.valid) {
      const { emailOrUsername, password } = this.testForm.value;
      
      try {
        const result = await this.firebaseAdminService.login(emailOrUsername, password);
        this.testResult = result;
        console.log('Test Login Ergebnis:', result);
      } catch (error: any) {
        this.testResult = {
          success: false,
          message: 'Test Login fehlgeschlagen: ' + (error?.message || 'Unbekannter Fehler')
        };
      }
    }
  }

  showConfig() {
    this.showConfigData = !this.showConfigData;
    
    if (this.showConfigData) {
      // Importiere die Konfiguration
      import('../../environments/firebase.config').then(module => {
        this.configData = module.firebaseConfig;
      });
    }
  }
}
