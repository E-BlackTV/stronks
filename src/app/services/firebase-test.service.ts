import { Injectable } from '@angular/core';
import { firebaseConfig } from '../../environments/firebase.config';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

export interface FirebaseTestResult {
  success: boolean;
  message: string;
  details?: any;
  recommendations?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseTestService {

  constructor() { }

  // Testet die Firebase-Konfiguration
  async testFirebaseConfiguration(): Promise<FirebaseTestResult> {
    const result: FirebaseTestResult = { success: false, message: '', recommendations: [] };

    try {
      console.log('🔍 Teste Firebase-Konfiguration...');
      if (!this.validateConfig(firebaseConfig)) {
        result.message = 'Firebase-Konfiguration ist unvollständig';
        result.recommendations?.push('Überprüfen Sie alle erforderlichen Konfigurationsfelder');
        return result;
      }

      const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      console.log('✅ Firebase App erfolgreich initialisiert/verwendet');

      const auth = getAuth(app);
      console.log('✅ Firebase Auth erfolgreich initialisiert');

      const db = getFirestore(app);
      console.log('✅ Firestore erfolgreich initialisiert');

      try {
        if (window.location.hostname === 'localhost') {
          connectAuthEmulator(auth, 'http://localhost:9099');
          connectFirestoreEmulator(db, 'localhost', 8080);
          console.log('✅ Emulator-Verbindung hergestellt');
        }
      } catch (_emulatorError) {
        console.log('ℹ️ Emulator nicht verfügbar, verwende Produktions-Firebase');
      }

      result.success = true;
      result.message = 'Firebase-Konfiguration ist korrekt';
      result.details = {
        projectId: firebaseConfig.projectId,
        authDomain: firebaseConfig.authDomain,
        hasEmulator: window.location.hostname === 'localhost'
      };
    } catch (error: any) {
      console.error('❌ Firebase-Konfigurationstest fehlgeschlagen:', error);
      result.message = 'Firebase-Konfiguration fehlgeschlagen: ' + error.message;
      if (error.code === 'auth/configuration-not-found') {
        result.recommendations?.push('Firebase Authentication ist nicht aktiviert');
        result.recommendations?.push('Aktivieren Sie E-Mail/Passwort-Authentifizierung in der Firebase Console');
      }
      if (error.code === 'firestore/unavailable') {
        result.recommendations?.push('Firestore Database ist nicht aktiviert');
        result.recommendations?.push('Erstellen Sie eine Firestore-Datenbank in der Firebase Console');
      }
      if (error.message?.includes('apiKey')) {
        result.recommendations?.push('API-Key ist ungültig oder fehlt');
        result.recommendations?.push('Überprüfen Sie die API-Key in der Firebase Console');
      }
    }

    return result;
  }

  private validateConfig(config: any): boolean {
    const requiredFields = ['apiKey','authDomain','projectId','storageBucket','messagingSenderId','appId'];
    for (const field of requiredFields) {
      if (!config[field] || (typeof config[field] === 'string' && config[field].trim() === '')) {
        console.error(`❌ Fehlendes Konfigurationsfeld: ${field}`);
        return false;
      }
    }
    return true;
  }

  // Testet die Netzwerk-Verbindung zu Firebase
  async testNetworkConnection(): Promise<FirebaseTestResult> {
    const result: FirebaseTestResult = { success: false, message: '', recommendations: [] };

    try {
      console.log('🌐 Teste Netzwerk-Verbindung zu Firebase...');

      const authResponse = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'diagnostic@test.invalid', password: 'diagnostic-123456', returnSecureToken: false })
        }
      );

      // Wenn wir irgendeine Antwort von der Firebase API erhalten, ist die Netzwerkverbindung OK.
      // Auch Fehler wie EMAIL_EXISTS bedeuten Konnektivität (HTTP erreicht, JSON geparst).
      let info: any = undefined;
      try { info = await authResponse.clone().json(); } catch { /* non-json body */ }

      result.success = true;
      result.message = authResponse.ok
        ? 'Netzwerk-Verbindung zu Firebase ist verfügbar'
        : `Netzwerk erreichbar (Antwort: ${info?.error?.message || authResponse.status})`;
      result.details = { status: authResponse.status, firebaseError: info?.error?.message };

      // Zusatz-Ping als Fallback-Check (keine Blockade):
      fetch('https://www.googleapis.com/generate_204').catch(() => {/* ignorieren */});
    } catch (error: any) {
      console.error('❌ Netzwerk-Test fehlgeschlagen:', error);
      result.success = false;
      result.message = 'Netzwerk-Verbindung fehlgeschlagen: ' + (error?.message || 'Unbekannter Fehler');
      result.recommendations?.push('Überprüfen Sie Ihre Internetverbindung');
      result.recommendations?.push('Überprüfen Sie Firewall-/CORS-Einstellungen');
    }

    return result;
  }

  // Vollständiger Diagnose-Test
  async runFullDiagnostic(): Promise<FirebaseTestResult[]> {
    console.log('🔧 Starte vollständige Firebase-Diagnose...');
    const results: FirebaseTestResult[] = [];
    results.push(await this.testFirebaseConfiguration());
    results.push(await this.testNetworkConnection());
    const summary: FirebaseTestResult = {
      success: results.every(r => r.success),
      message: `Diagnose abgeschlossen: ${results.filter(r => r.success).length}/${results.length} Tests erfolgreich`,
      details: {
        totalTests: results.length,
        successfulTests: results.filter(r => r.success).length,
        failedTests: results.filter(r => !r.success).length
      }
    };
    results.push(summary);
    return results;
  }

  logDiagnosticInfo(): void {
    console.log('📋 Firebase Diagnose-Informationen:');
    console.log('Konfiguration:', firebaseConfig);
    console.log('Hostname:', window.location.hostname);
    console.log('Protokoll:', window.location.protocol);
    console.log('User Agent:', navigator.userAgent);
    console.log('Online Status:', navigator.onLine);
  }
} 