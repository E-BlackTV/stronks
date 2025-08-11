import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {
  user$: Observable<any>;

  constructor(private afAuth: AngularFireAuth, private router: Router) {
    this.user$ = afAuth.authState;
  }

  login(email: string, password: string): Promise<void> {
    return this.afAuth
      .signInWithEmailAndPassword(email, password)
      .then(() => {
        this.router.navigate(['/home']);
      })
      .catch((error) => {
        console.error('Login error:', error);
        throw error;
      });
  }

  logout(): Promise<void> {
    return this.afAuth.signOut().then(() => {
      this.router.navigate(['/login']);
    });
  }

  isLoggedIn(): Observable<boolean> {
    return this.user$.pipe(map(user => !!user));
  }
}
