import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  loginForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private navCtrl: NavController
  ) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required],
      rememberMe: [false],
    });
  }

  ngOnInit() {}

  onLogin() {
    if (this.loginForm.valid) {
      this.http.post<{ success: boolean; message: string }>(
        'http://localhost/ionic_backend/login.php',
        this.loginForm.value
      ).subscribe(response => {
        if (response.success) {
          // Weiterleitung zur Startseite
          this.navCtrl.navigateRoot('/home');
        } else {
          // Fehlermeldung anzeigen
          alert(response.message);
        }
      }, error => {
        console.error('Fehler bei der Anfrage', error);
      });
    }
  }
}