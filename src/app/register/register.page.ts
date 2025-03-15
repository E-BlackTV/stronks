import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage implements OnInit {
  registerForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private navCtrl: NavController
  ) {}

  ngOnInit() {
    this.registerForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    }, { validator: this.passwordMatchValidator });
  }

  passwordMatchValidator(form: FormGroup) {
    return form.get('password')?.value === form.get('confirmPassword')?.value
      ? null
      : { mismatch: true };
  }

  onRegister() {
    if (this.registerForm.invalid) {
      alert('Bitte fülle alle Felder korrekt aus.');
      return;
    }
    
    this.http
      .post('http://localhost/stronks/backend/register.php', this.registerForm.value)
      .subscribe(
        (response: any) => {
          if (response.success) {
            alert(response.message);
            this.navCtrl.navigateRoot('/login');
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