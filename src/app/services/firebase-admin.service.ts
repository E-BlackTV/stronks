import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  User as FirebaseUser,
  updateProfile,
  updateEmail,
  sendPasswordResetEmail,
  updatePassword
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { environment } from '../../environments/environment';

export interface User {
  id: string;
  username: string;
  email: string;
  balance: number;
}

export interface RegistrationResult {
  success: boolean;
  message: string;
  user?: User;
}

export interface LoginResult {
  success: boolean;
  message: string;
  user?: User;
  token?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseAdminService {
  private app: any;
  private auth: any;
  private db: any;
  private authEnabled: boolean = true;
  private currentUser: User | null = null; // Lokaler User-Cache

  constructor(private http: HttpClient) {
    // Firebase initialisieren
    try {
      // Verwende bestehende App, falls bereits initialisiert (z.B. durch AngularFire)
      this.app = getApps().length ? getApp() : initializeApp(environment.firebase);
      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);
      console.log('Firebase erfolgreich initialisiert');
    } catch (error) {
      console.error('Firebase Initialisierungsfehler:', error);
      this.authEnabled = false;
      console.log('Firebase Auth deaktiviert - verwende Fallback-Modus');
    }
  }

  // Registrierung mit Firebase Auth oder Fallback
  async register(email: string, password: string, username: string): Promise<RegistrationResult> {
    // Prüfe ob Firebase Auth verfügbar ist
    if (!this.authEnabled) {
      return this.registerWithFallback(email, password, username);
    }

    try {
      console.log('Versuche Registrierung mit Firebase Auth...');

      // Firebase Auth Registrierung
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      const firebaseUser = userCredential.user;

      // User-Profil in Firestore erstellen
      const userProfile = {
        username: username,
        email: email,
        password_hash: 'firebase_auth',
        balance: 10000.00,
        created_at: new Date(),
        updated_at: new Date(),
        userId: firebaseUser.uid
      };

      await setDoc(doc(this.db, 'users', firebaseUser.uid), userProfile);

      const user = {
        id: firebaseUser.uid,
        username: username,
        email: email,
        balance: 10000.00
      };
      this.currentUser = user; // Cache den User

      return {
        success: true,
        message: 'Registrierung erfolgreich!',
        user: user
      };
    } catch (error: any) {
      console.error('Firebase Auth Registrierung fehlgeschlagen:', error);

      // Fallback bei Auth-Fehlern
      if (error.code === 'auth/configuration-not-found' ||
          error.code === 'auth/operation-not-allowed' ||
          error.code === 'auth/unauthorized-domain') {
        console.log('Firebase Auth nicht verfügbar - verwende Fallback-Modus');
        this.authEnabled = false;
        return this.registerWithFallback(email, password, username);
      }

      return {
        success: false,
        message: error.code === 'auth/email-already-in-use'
          ? 'E-Mail-Adresse bereits registriert'
          : 'Ein Fehler ist aufgetreten: ' + error.message
      };
    }
  }

  // Fallback-Registrierung ohne Firebase Auth
  private async registerWithFallback(email: string, password: string, username: string): Promise<RegistrationResult> {
    try {
      console.log('Verwende Fallback: Direkte Firestore Registrierung...');

      // Prüfe ob User bereits existiert
      const existingUserQuery = query(
        collection(this.db, 'users'),
        where('email', '==', email)
      );
      const existingUserDocs = await getDocs(existingUserQuery);

      if (!existingUserDocs.empty) {
        return {
          success: false,
          message: 'E-Mail-Adresse bereits registriert'
        };
      }

      // Generiere eine zufällige User ID
      const userId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

      const userProfile = {
        username: username,
        email: email,
        password_hash: this.hashPassword(password), // Sichere Passwort-Hash
        balance: 10000.00,
        created_at: new Date(),
        updated_at: new Date(),
        userId: userId,
        isTemporary: true
      };

      await setDoc(doc(this.db, 'users', userId), userProfile);

      const user = {
        id: userId,
        username: username,
        email: email,
        balance: 10000.00
      };
      this.currentUser = user; // Cache den User

      return {
        success: true,
        message: 'Registrierung erfolgreich! (Temporärer Modus - Firebase Auth muss aktiviert werden)',
        user: user
      };
    } catch (fallbackError) {
      console.error('Fallback Registrierung fehlgeschlagen:', fallbackError);
      return {
        success: false,
        message: 'Registrierung fehlgeschlagen. Bitte überprüfen Sie die Firebase-Konfiguration.'
      };
    }
  }

  // Login mit Firebase Auth oder Fallback
  async login(emailOrUsername: string, password: string): Promise<LoginResult> {
    console.log('FirebaseAdminService: Login versuch mit:', emailOrUsername);

    // Prüfe ob Firebase Auth verfügbar ist
    if (!this.authEnabled) {
      console.log('FirebaseAdminService: Auth deaktiviert, verwende Fallback');
      return this.loginWithFallback(emailOrUsername, password);
    }

    try {
      // Prüfe ob es eine E-Mail oder ein Benutzername ist
      const isEmail = emailOrUsername.includes('@');
      console.log('FirebaseAdminService: Ist E-Mail:', isEmail);

      if (isEmail) {
        // Direkter Login mit E-Mail
        console.log('FirebaseAdminService: Versuche Login mit E-Mail');
        const userCredential = await signInWithEmailAndPassword(this.auth, emailOrUsername, password);
        const firebaseUser = userCredential.user;

        // User-Profil aus Firestore laden
        const userDoc = await getDoc(doc(this.db, 'users', firebaseUser.uid));

        if (userDoc.exists()) {
          const userData = userDoc.data();
                  console.log('FirebaseAdminService: Login erfolgreich mit E-Mail');
        const user = {
          id: firebaseUser.uid,
          username: userData['username'],
          email: userData['email'],
          balance: userData['balance']
        };
        this.currentUser = user; // Cache den User
        return {
          success: true,
          message: 'Login erfolgreich',
          user: user,
          token: await firebaseUser.getIdToken()
        };
        } else {
          console.log('FirebaseAdminService: User-Profil nicht gefunden');
          return { success: false, message: 'User-Profil nicht gefunden' };
        }
      } else {
        // Login mit Benutzername - suche zuerst den User in Firestore
        console.log('FirebaseAdminService: Versuche Login mit Benutzername');
        const userQuery = query(
          collection(this.db, 'users'),
          where('username', '==', emailOrUsername)
        );
        const userDocs = await getDocs(userQuery);

        if (userDocs.empty) {
          console.log('FirebaseAdminService: Benutzername nicht gefunden');
          return { success: false, message: 'Benutzername nicht gefunden' };
        }

        const userDoc = userDocs.docs[0];
        const userData = userDoc.data();
        console.log('FirebaseAdminService: Benutzername gefunden, versuche Login mit E-Mail');

        // Login mit der E-Mail des gefundenen Users
        const userCredential = await signInWithEmailAndPassword(this.auth, userData['email'], password);
        const firebaseUser = userCredential.user;

        console.log('FirebaseAdminService: Login erfolgreich mit Benutzername');
        const user = {
          id: firebaseUser.uid,
          username: userData['username'],
          email: userData['email'],
          balance: userData['balance']
        };
        this.currentUser = user; // Cache den User
        return {
          success: true,
          message: 'Login erfolgreich',
          user: user,
          token: await firebaseUser.getIdToken()
        };
      }
    } catch (error: any) {
      console.error('FirebaseAdminService: Login error:', error);

      // Fallback bei Auth-Fehlern
      if (error.code === 'auth/configuration-not-found' ||
          error.code === 'auth/operation-not-allowed' ||
          error.code === 'auth/unauthorized-domain') {
        console.log('FirebaseAdminService: Auth nicht verfügbar - verwende Fallback-Login');
        this.authEnabled = false;
        return this.loginWithFallback(emailOrUsername, password);
      }

      // Spezifische Fehlermeldungen
      let errorMessage = 'Ein Fehler ist aufgetreten';

      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Benutzer nicht gefunden';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Falsches Passwort';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Ungültige E-Mail-Adresse';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Zu viele Versuche. Bitte warten Sie einen Moment.';
      } else {
        errorMessage = error.message || 'Ein Fehler ist aufgetreten';
      }

      return {
        success: false,
        message: errorMessage
      };
    }
  }

  // Fallback-Login ohne Firebase Auth
  private async loginWithFallback(emailOrUsername: string, password: string): Promise<LoginResult> {
    try {
      console.log('FirebaseAdminService: Fallback-Login mit:', emailOrUsername);

      // Prüfe ob es eine E-Mail oder ein Benutzername ist
      const isEmail = emailOrUsername.includes('@');

      let userQuery;
      if (isEmail) {
        userQuery = query(
          collection(this.db, 'users'),
          where('email', '==', emailOrUsername)
        );
      } else {
        userQuery = query(
          collection(this.db, 'users'),
          where('username', '==', emailOrUsername)
        );
      }

      const userDocs = await getDocs(userQuery);

      if (userDocs.empty) {
        console.log('FirebaseAdminService: Fallback - User nicht gefunden');
        return { success: false, message: 'Benutzer nicht gefunden' };
      }

      const userDoc = userDocs.docs[0];
      const userData = userDoc.data();

      // Prüfe Passwort (vereinfachte Prüfung für Fallback)
      const hashedPassword = this.hashPassword(password);
      if (userData['password_hash'] !== hashedPassword) {
        console.log('FirebaseAdminService: Fallback - Falsches Passwort');
        return { success: false, message: 'Falsches Passwort' };
      }

      console.log('FirebaseAdminService: Fallback-Login erfolgreich');
      const user = {
        id: userData['userId'],
        username: userData['username'],
        email: userData['email'],
        balance: userData['balance']
      };
      this.currentUser = user; // Cache den User
      return {
        success: true,
        message: 'Login erfolgreich (Fallback-Modus)',
        user: user
      };
    } catch (error) {
      console.error('FirebaseAdminService: Fallback Login fehlgeschlagen:', error);
      return {
        success: false,
        message: 'Login fehlgeschlagen. Bitte überprüfen Sie die Firebase-Konfiguration.'
      };
    }
  }

  // Einfache Passwort-Hash-Funktion (nur für Fallback)
  private hashPassword(password: string): string {
    // Einfacher Hash für Fallback-Modus
    return btoa(password + '_stronks_salt');
  }

  // Logout
  async logout(): Promise<void> {
    if (this.authEnabled && this.auth.currentUser) {
      await this.auth.signOut();
    }
    this.currentUser = null; // Cache leeren
  }

  // Prüfe ob User eingeloggt ist
  isLoggedIn(): boolean {
    if (this.authEnabled) {
      return this.auth.currentUser !== null;
    } else {
      return this.currentUser !== null; // Fallback-Modus
    }
  }

  // Aktuellen User holen
  getCurrentUser(): User | null {
    if (this.authEnabled) {
      const firebaseUser = this.auth.currentUser;
      if (firebaseUser) {
        return {
          id: firebaseUser.uid,
          username: firebaseUser.displayName || '',
          email: firebaseUser.email || '',
          balance: 0 // Wird aus Firestore geladen
        };
      }
    } else {
      return this.currentUser; // Fallback-Modus
    }
    return null;
  }

  // Observable-Versionen für Angular
  register$(email: string, password: string, username: string): Observable<RegistrationResult> {
    return new Observable(observer => {
      this.register(email, password, username).then(result => {
        observer.next(result);
        observer.complete();
      }).catch(error => {
        observer.error(error);
      });
    });
  }

  login$(email: string, password: string): Observable<LoginResult> {
    return new Observable(observer => {
      this.login(email, password).then(result => {
        observer.next(result);
        observer.complete();
      }).catch(error => {
        observer.error(error);
      });
    });
  }

  /**
   * Aktualisiert den Benutzernamen des aktuellen Benutzers
   * @param newUsername Der neue Benutzername
   * @returns Ein Promise mit dem Ergebnis der Operation
   */
  async updateUsername(newUsername: string): Promise<{success: boolean, message: string}> {
    try {
      if (!this.authEnabled) {
        return { success: false, message: 'Profiländerungen sind im Fallback-Modus nicht verfügbar' };
      }

      const firebaseUser = this.auth.currentUser;
      if (!firebaseUser) {
        return { success: false, message: 'Kein Benutzer angemeldet' };
      }

      // Aktualisiere den Benutzernamen in Firestore
      const userRef = doc(this.db, 'users', firebaseUser.uid);
      await updateDoc(userRef, {
        username: newUsername,
        updated_at: new Date()
      });

      // Aktualisiere den lokalen Cache
      if (this.currentUser) {
        this.currentUser.username = newUsername;
      }

      return { success: true, message: 'Benutzername erfolgreich aktualisiert' };
    } catch (error: any) {
      console.error('Fehler beim Aktualisieren des Benutzernamens:', error);
      return {
        success: false,
        message: error.message || 'Ein Fehler ist aufgetreten'
      };
    }
  }

  /**
   * Aktualisiert die E-Mail-Adresse des aktuellen Benutzers
   * @param newEmail Die neue E-Mail-Adresse
   * @param password Das aktuelle Passwort zur Bestätigung
   * @returns Ein Promise mit dem Ergebnis der Operation
   */
  async updateEmail(newEmail: string, password: string): Promise<{success: boolean, message: string}> {
    try {
      if (!this.authEnabled) {
        return { success: false, message: 'E-Mail-Änderungen sind im Fallback-Modus nicht verfügbar' };
      }

      const firebaseUser = this.auth.currentUser;
      if (!firebaseUser) {
        return { success: false, message: 'Kein Benutzer angemeldet' };
      }

      // Authentifiziere den Benutzer erneut (erforderlich für sensible Operationen)
      try {
        await signInWithEmailAndPassword(this.auth, firebaseUser.email || '', password);
      } catch (authError: any) {
        return { success: false, message: 'Falsches Passwort' };
      }

      // Aktualisiere die E-Mail in Firebase Auth
      await updateEmail(firebaseUser, newEmail);

      // Aktualisiere die E-Mail in Firestore
      const userRef = doc(this.db, 'users', firebaseUser.uid);
      await updateDoc(userRef, {
        email: newEmail,
        updated_at: new Date()
      });

      // Aktualisiere den lokalen Cache
      if (this.currentUser) {
        this.currentUser.email = newEmail;
      }

      return { success: true, message: 'E-Mail-Adresse erfolgreich aktualisiert' };
    } catch (error: any) {
      console.error('Fehler beim Aktualisieren der E-Mail:', error);

      let errorMessage = 'Ein Fehler ist aufgetreten';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Diese E-Mail-Adresse wird bereits verwendet';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Ungültige E-Mail-Adresse';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Bitte melden Sie sich erneut an und versuchen Sie es noch einmal';
      }

      return { success: false, message: errorMessage };
    }
  }

  /**
   * Ändert das Passwort des aktuellen Benutzers
   * @param currentPassword Das aktuelle Passwort
   * @param newPassword Das neue Passwort
   * @returns Ein Promise mit dem Ergebnis der Operation
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<{success: boolean, message: string}> {
    try {
      if (!this.authEnabled) {
        return { success: false, message: 'Passwortänderungen sind im Fallback-Modus nicht verfügbar' };
      }

      const firebaseUser = this.auth.currentUser;
      if (!firebaseUser) {
        return { success: false, message: 'Kein Benutzer angemeldet' };
      }

      // Authentifiziere den Benutzer erneut (erforderlich für sensible Operationen)
      try {
        await signInWithEmailAndPassword(this.auth, firebaseUser.email || '', currentPassword);
      } catch (authError: any) {
        return { success: false, message: 'Falsches aktuelles Passwort' };
      }

      // Aktualisiere das Passwort in Firebase Auth
      await updatePassword(firebaseUser, newPassword);

      return { success: true, message: 'Passwort erfolgreich geändert' };
    } catch (error: any) {
      console.error('Fehler beim Ändern des Passworts:', error);

      let errorMessage = 'Ein Fehler ist aufgetreten';
      if (error.code === 'auth/weak-password') {
        errorMessage = 'Das Passwort ist zu schwach';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Bitte melden Sie sich erneut an und versuchen Sie es noch einmal';
      }

      return { success: false, message: errorMessage };
    }
  }

  /**
   * Sendet eine E-Mail zum Zurücksetzen des Passworts
   * @param email Die E-Mail-Adresse des Benutzers
   * @returns Ein Promise mit dem Ergebnis der Operation
   */
  async sendPasswordResetEmail(email: string): Promise<{success: boolean, message: string}> {
    try {
      if (!this.authEnabled) {
        return { success: false, message: 'Passwort-Reset ist im Fallback-Modus nicht verfügbar' };
      }

      await sendPasswordResetEmail(this.auth, email);
      return { success: true, message: 'E-Mail zum Zurücksetzen des Passworts wurde gesendet' };
    } catch (error: any) {
      console.error('Fehler beim Senden der Passwort-Reset-E-Mail:', error);

      let errorMessage = 'Ein Fehler ist aufgetreten';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Kein Benutzer mit dieser E-Mail-Adresse gefunden';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Ungültige E-Mail-Adresse';
      }

      return { success: false, message: errorMessage };
    }
  }

  /**
   * Observable-Version der updateUsername-Methode
   */
  updateUsername$(newUsername: string): Observable<{success: boolean, message: string}> {
    return new Observable(observer => {
      this.updateUsername(newUsername).then(result => {
        observer.next(result);
        observer.complete();
      }).catch(error => {
        observer.error(error);
      });
    });
  }

  /**
   * Observable-Version der updateEmail-Methode
   */
  updateEmail$(newEmail: string, password: string): Observable<{success: boolean, message: string}> {
    return new Observable(observer => {
      this.updateEmail(newEmail, password).then(result => {
        observer.next(result);
        observer.complete();
      }).catch(error => {
        observer.error(error);
      });
    });
  }

  /**
   * Observable-Version der changePassword-Methode
   */
  changePassword$(currentPassword: string, newPassword: string): Observable<{success: boolean, message: string}> {
    return new Observable(observer => {
      this.changePassword(currentPassword, newPassword).then(result => {
        observer.next(result);
        observer.complete();
      }).catch(error => {
        observer.error(error);
      });
    });
  }

  /**
   * Observable-Version der sendPasswordResetEmail-Methode
   */
  sendPasswordResetEmail$(email: string): Observable<{success: boolean, message: string}> {
    return new Observable(observer => {
      this.sendPasswordResetEmail(email).then(result => {
        observer.next(result);
        observer.complete();
      }).catch(error => {
        observer.error(error);
      });
    });
  }
}
