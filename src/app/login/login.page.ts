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
    });
  }

  ngOnInit() {}

  onLogin() {
    this.http
      .post('http://localhost/stronks/backend/login.php', this.loginForm.value)
      .subscribe(
        (response: any) => {
          if (response.success) {
            alert(response.message);
            this.navCtrl.navigateRoot('/home');
          } else {
            alert(response.message);
          }
        },
        (error) => {
          console.error('Fehler bei der Anfrage:', error);
          alert('Serverfehler. Prüfen Sie die Konsole für Details.');
        }
      );
  }
}
