import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { FirebaseAdminService } from '../services/firebase-admin.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  loginForm: FormGroup;
  error: string = '';
  loading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private firebaseService: FirebaseAdminService,
    private router: Router
  ) {
    console.log('LoginPage: Constructor aufgerufen');
    this.loginForm = this.fb.group({
      emailOrUsername: ['', [Validators.required, this.emailOrUsernameValidator()]],
      password: ['', Validators.required],
    });
  }

  // Custom Validator für E-Mail oder Benutzername
  emailOrUsernameValidator() {
    return (control: any) => {
      const value = control.value;
      if (!value) {
        return { required: true };
      }
      
      // Prüfe ob es eine E-Mail ist
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailPattern.test(value)) {
        return null; // Gültige E-Mail
      }
      
      // Prüfe ob es ein gültiger Benutzername ist (mindestens 3 Zeichen, nur Buchstaben, Zahlen, Unterstriche)
      const usernamePattern = /^[a-zA-Z0-9_]{3,}$/;
      if (usernamePattern.test(value)) {
        return null; // Gültiger Benutzername
      }
      
      return { invalidFormat: true };
    };
  }

  // Getter für einfacheren Zugriff auf Form-Fehler
  get emailOrUsernameError(): string {
    const control = this.loginForm.get('emailOrUsername');
    if (control?.errors && control.touched) {
      if (control.errors['required']) return 'E-Mail oder Benutzername ist erforderlich';
      if (control.errors['invalidFormat']) return 'Bitte gib eine gültige E-Mail-Adresse oder einen gültigen Benutzernamen ein';
    }
    return '';
  }

  get passwordError(): string {
    const control = this.loginForm.get('password');
    if (control?.errors && control.touched) {
      if (control.errors['required']) return 'Passwort ist erforderlich';
    }
    return '';
  }

  async onLogin() {
    console.log('LoginPage: onLogin aufgerufen');
    
    // Markiere alle Felder als touched für bessere Validierung
    Object.keys(this.loginForm.controls).forEach(key => {
      const control = this.loginForm.get(key);
      control?.markAsTouched();
    });

    console.log('LoginPage: Form valid:', this.loginForm.valid);
    console.log('LoginPage: Form values:', this.loginForm.value);

    if (this.loginForm.valid) {
      this.loading = true;
      this.error = '';
      
      const { emailOrUsername, password } = this.loginForm.value;
      
      console.log('LoginPage: Versuche Login mit:', { emailOrUsername, password: '***' });
      
      try {
        const result = await this.firebaseService.login(emailOrUsername, password);
        
        console.log('LoginPage: Login-Ergebnis:', result);
        
        if (result.success) {
          console.log('LoginPage: Login erfolgreich, navigiere zu /home');
          // Erfolgreicher Login - Navigiere zur Home-Seite
          this.router.navigate(['/home']);
        } else {
          console.log('LoginPage: Login fehlgeschlagen:', result.message);
          this.error = result.message;
        }
      } catch (error) {
        console.error('LoginPage: Login error:', error);
        this.error = 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.';
      } finally {
        this.loading = false;
      }
    } else {
      console.log('LoginPage: Form ist nicht gültig');
      this.error = 'Bitte korrigiere die Fehler im Formular.';
    }
  }

  goToRegister() {
    console.log('LoginPage: Navigiere zu /register');
    this.router.navigate(['/register']);
  }

  // Hilfsmethode um zu prüfen ob ein Feld einen Fehler hat
  hasError(fieldName: string): boolean {
    const control = this.loginForm.get(fieldName);
    return !!(control?.errors && control.touched);
  }
}
