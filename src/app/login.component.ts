import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  loginForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
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
      this.http
        .post<any>(
          'https://web053.wifiooe.at/backend/login.php', // Direkte Server-Verbindung
          {
            username: this.username,
            password: this.password,
          }
        )
        .subscribe(
          (response) => {
            if (response.success) {
              // Weiterleitung zur Startseite
              this.router.navigate(['/home']);
            } else {
              // Fehlermeldung anzeigen
              alert(response.message);
            }
          },
          (error) => {
            console.error('Fehler bei der Anfrage', error);
          }
        );
    }
  }
}
