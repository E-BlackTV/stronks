import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthenticationService } from './services/authentication.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  loginForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: AuthenticationService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required],
      rememberMe: [false],
    });
  }

  onLogin() {
    if (this.loginForm.valid) {
      const username = this.loginForm.get('username')?.value;
      const password = this.loginForm.get('password')?.value;
      
      this.authService.login(username, password).subscribe(
        (success: boolean) => {
          if (success) {
            // Weiterleitung zur Startseite
            this.router.navigate(['/home']);
          } else {
            // Fehlermeldung anzeigen
            alert('Anmeldung fehlgeschlagen');
          }
        },
        (error: any) => {
          console.error('Fehler bei der Anfrage', error);
          alert('Fehler bei der Anmeldung');
        }
      );
    }
  }

  get username() {
    return this.loginForm.get('username')?.value;
  }

  get password() {
    return this.loginForm.get('password')?.value;
  }
}
