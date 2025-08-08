import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { NavController } from '@ionic/angular';
import { FirebaseAdminService } from '../services/firebase-admin.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['../../global.scss'],
})
export class RegisterPage implements OnInit {
  registerForm!: FormGroup;
  error: string = '';
  loading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private firebaseService: FirebaseAdminService,
    public navCtrl: NavController
  ) {}

  ngOnInit() {
    this.registerForm = this.fb.group(
      {
        username: ['', [Validators.required, Validators.minLength(3)]],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator }
    );
  }

  // Korrigierter Password Match Validator
  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (password && confirmPassword && password.value !== confirmPassword.value) {
      return { passwordMismatch: true };
    }

    return null;
  }

  // Getter für einfacheren Zugriff auf Form-Fehler
  get usernameError(): string {
    const control = this.registerForm.get('username');
    if (control?.errors && control.touched) {
      if (control.errors['required']) return 'Benutzername ist erforderlich';
      if (control.errors['minlength']) return 'Benutzername muss mindestens 3 Zeichen haben';
    }
    return '';
  }

  get emailError(): string {
    const control = this.registerForm.get('email');
    if (control?.errors && control.touched) {
      if (control.errors['required']) return 'E-Mail ist erforderlich';
      if (control.errors['email']) return 'Bitte gib eine gültige E-Mail-Adresse ein';
    }
    return '';
  }

  get passwordError(): string {
    const control = this.registerForm.get('password');
    if (control?.errors && control.touched) {
      if (control.errors['required']) return 'Passwort ist erforderlich';
      if (control.errors['minlength']) return 'Passwort muss mindestens 6 Zeichen haben';
    }
    return '';
  }

  get confirmPasswordError(): string {
    const control = this.registerForm.get('confirmPassword');
    if (control?.errors && control.touched) {
      if (control.errors['required']) return 'Passwort-Bestätigung ist erforderlich';
    }
    return '';
  }

  get passwordMismatchError(): string {
    if (this.registerForm.errors?.['passwordMismatch'] && this.registerForm.get('confirmPassword')?.touched) {
      return 'Passwörter stimmen nicht überein';
    }
    return '';
  }

  async onRegister() {
    // Markiere alle Felder als touched für bessere Validierung
    Object.keys(this.registerForm.controls).forEach(key => {
      const control = this.registerForm.get(key);
      control?.markAsTouched();
    });

    if (this.registerForm.invalid) {
      this.error = 'Bitte korrigiere die Fehler im Formular.';
      return;
    }

    this.loading = true;
    this.error = '';

    const { username, email, password } = this.registerForm.value;

    try {
      const result = await this.firebaseService.register(email, password, username);
      
      if (result.success) {
        alert(result.message);
        this.navCtrl.navigateRoot('/login');
      } else {
        this.error = result.message;
      }
    } catch (error) {
      console.error('Registration error:', error);
      this.error = 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.';
    } finally {
      this.loading = false;
    }
  }

  // Hilfsmethode um zu prüfen ob ein Feld einen Fehler hat
  hasError(fieldName: string): boolean {
    const control = this.registerForm.get(fieldName);
    return !!(control?.errors && control.touched);
  }
}
