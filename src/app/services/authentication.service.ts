import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import firebase from 'firebase/compat/app';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {
  user$: Observable<any>;

  constructor(private afAuth: AngularFireAuth, private router: Router) {
    this.user$ = afAuth.authState;
  }

  login(email: string, password: string, remember: boolean = false): Promise<void> {
    const persistence = remember
      ? firebase.auth.Auth.Persistence.LOCAL
      : firebase.auth.Auth.Persistence.SESSION;

    return this.afAuth
      .setPersistence(persistence)
      .then(() => this.afAuth.signInWithEmailAndPassword(email, password))
      .then(() => {
        this.router.navigate(['/wallet']);
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
