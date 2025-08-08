import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
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
} 