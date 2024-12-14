import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap, delay } from 'rxjs/operators';
import { Storage } from '@ionic/storage-angular';

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {
  private isAuthenticated = false;
  private readonly TOKEN_KEY = 'auth-token';

  constructor(private storage: Storage) {
    this.storage.create();
  }

  login(username: string, password: string, rememberMe: boolean): Observable<boolean> {
    // Hier sollte die tatsächliche Authentifizierung gegen eine Datenbank erfolgen
    if (username === 'demo' && password === 'demo') {
      return of(true).pipe(
        delay(1000),
        tap(async () => {
          this.isAuthenticated = true;
          if (rememberMe) {
            await this.storage.set(this.TOKEN_KEY, 'Bearer 1234567');
          }
        })
      );
    } else {
      return of(false);
    }
  }

  logout(): Promise<void> {
    this.isAuthenticated = false;
    return this.storage.remove(this.TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated;
  }
}