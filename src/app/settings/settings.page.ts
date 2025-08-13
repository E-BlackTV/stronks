import { Component, OnInit } from '@angular/core';
import { FirebaseAdminService, User } from '../services/firebase-admin.service';
import { FirestoreService } from '../services/firestore.service';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';

/**
 * Einstellungsseite
 *
 * Diese Seite ermöglicht dem Benutzer, seine Profileinstellungen zu verwalten,
 * einschließlich der Änderung des Benutzernamens, der E-Mail-Adresse und des Passworts.
 * Außerdem kann der Benutzer eine E-Mail zum Zurücksetzen des Passworts anfordern.
 */
@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {
  // Formulare für die verschiedenen Einstellungen
  profileForm: FormGroup;
  emailForm: FormGroup;
  passwordForm: FormGroup;
  resetPasswordForm: FormGroup;

  // Aktueller Benutzer
  currentUser: User | null = null;

  // UI-Steuerung
  showProfileForm = false;
  showEmailForm = false;
  showPasswordForm = false;
  showResetPasswordForm = false;

  constructor(
    private router: Router,
    private firebaseService: FirebaseAdminService,
    private firestore: FirestoreService,
    private formBuilder: FormBuilder,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {
    // Initialisiere die Formulare
    this.profileForm = this.formBuilder.group({
      username: ['', [Validators.required, Validators.minLength(3)]]
    });

    this.emailForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });

    this.passwordForm = this.formBuilder.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    });

    this.resetPasswordForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  /**
   * Initialisiert die Seite und lädt die Benutzerdaten
   */
  ngOnInit() {
    this.loadUserData();
  }

  /**
   * Lädt die Daten des aktuellen Benutzers
   */
  loadUserData() {
    this.currentUser = this.firebaseService.getCurrentUser();

    if (this.currentUser) {
      // Setze die Standardwerte für die Formulare
      this.profileForm.patchValue({
        username: this.currentUser.username
      });

      this.emailForm.patchValue({
        email: this.currentUser.email
      });

      this.resetPasswordForm.patchValue({
        email: this.currentUser.email
      });
    }
  }

  /**
   * Zeigt oder versteckt das Profilformular
   */
  toggleProfileForm() {
    this.showProfileForm = !this.showProfileForm;
    if (!this.showProfileForm) {
      // Zurücksetzen des Formulars, wenn es geschlossen wird
      this.loadUserData();
    }
  }

  /**
   * Zeigt oder versteckt das E-Mail-Formular
   */
  toggleEmailForm() {
    this.showEmailForm = !this.showEmailForm;
    if (!this.showEmailForm) {
      // Zurücksetzen des Formulars, wenn es geschlossen wird
      this.loadUserData();
      this.emailForm.patchValue({
        password: ''
      });
    }
  }

  /**
   * Zeigt oder versteckt das Passwort-Formular
   */
  togglePasswordForm() {
    this.showPasswordForm = !this.showPasswordForm;
    if (!this.showPasswordForm) {
      // Zurücksetzen des Formulars, wenn es geschlossen wird
      this.passwordForm.reset();
    }
  }

  /**
   * Zeigt oder versteckt das Passwort-Reset-Formular
   */
  toggleResetPasswordForm() {
    this.showResetPasswordForm = !this.showResetPasswordForm;
    if (!this.showResetPasswordForm) {
      // Zurücksetzen des Formulars, wenn es geschlossen wird
      this.loadUserData();
    }
  }

  /**
   * Aktualisiert den Benutzernamen
   */
  async updateProfile() {
    if (this.profileForm.invalid) {
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Bitte warten...'
    });
    await loading.present();

    try {
      const { username } = this.profileForm.value;
      const result = await this.firebaseService.updateUsername(username);

      await loading.dismiss();

      if (result.success) {
        this.showToast(result.message, 'success');
        this.toggleProfileForm();
        this.loadUserData();
      } else {
        this.showToast(result.message, 'danger');
      }
    } catch (error) {
      await loading.dismiss();
      this.showToast('Ein Fehler ist aufgetreten', 'danger');
    }
  }

  /**
   * Aktualisiert die E-Mail-Adresse
   */
  async updateEmail() {
    if (this.emailForm.invalid) {
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Bitte warten...'
    });
    await loading.present();

    try {
      const { email, password } = this.emailForm.value;
      const result = await this.firebaseService.updateEmail(email, password);

      await loading.dismiss();

      if (result.success) {
        this.showToast(result.message, 'success');
        this.toggleEmailForm();
        this.loadUserData();
      } else {
        this.showToast(result.message, 'danger');
      }
    } catch (error) {
      await loading.dismiss();
      this.showToast('Ein Fehler ist aufgetreten', 'danger');
    }
  }

  /**
   * Ändert das Passwort
   */
  async changePassword() {
    if (this.passwordForm.invalid) {
      return;
    }

    const { newPassword, confirmPassword } = this.passwordForm.value;
    if (newPassword !== confirmPassword) {
      this.showToast('Die Passwörter stimmen nicht überein', 'danger');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Bitte warten...'
    });
    await loading.present();

    try {
      const { currentPassword, newPassword } = this.passwordForm.value;
      const result = await this.firebaseService.changePassword(currentPassword, newPassword);

      await loading.dismiss();

      if (result.success) {
        this.showToast(result.message, 'success');
        this.togglePasswordForm();
        this.passwordForm.reset();
      } else {
        this.showToast(result.message, 'danger');
      }
    } catch (error) {
      await loading.dismiss();
      this.showToast('Ein Fehler ist aufgetreten', 'danger');
    }
  }

  /**
   * Sendet eine E-Mail zum Zurücksetzen des Passworts
   */
  async resetPassword() {
    if (this.resetPasswordForm.invalid) {
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Bitte warten...'
    });
    await loading.present();

    try {
      const { email } = this.resetPasswordForm.value;
      const result = await this.firebaseService.sendPasswordResetEmail(email);

      await loading.dismiss();

      if (result.success) {
        this.showToast(result.message, 'success');
        this.toggleResetPasswordForm();
      } else {
        this.showToast(result.message, 'danger');
      }
    } catch (error) {
      await loading.dismiss();
      this.showToast('Ein Fehler ist aufgetreten', 'danger');
    }
  }

  /**
   * Zeigt eine Toast-Nachricht an
   */
  async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    await toast.present();
  }

  /**
   * Meldet den Benutzer ab
   */
  async logout() {
    try {
      await this.firebaseService.logout();
    } finally {
      this.router.navigate(['/login']);
    }
  }
}
