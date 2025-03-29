import { Injectable } from '@angular/core';
import { Observable, from, BehaviorSubject } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { Storage } from '@ionic/storage-angular';
import { HttpClient } from '@angular/common/http';

interface User {
  id: number;
  username: string;
  accountbalance: number;
}

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;
  private readonly USER_KEY = 'current-user';

  constructor(private storage: Storage, private http: HttpClient) {
    this.storage.create();
    this.currentUserSubject = new BehaviorSubject<User | null>(null);
    this.currentUser = this.currentUserSubject.asObservable();
    this.checkStoredUser();
  }

  private async checkStoredUser() {
    const user = await this.storage.get(this.USER_KEY);
    if (user) {
      this.currentUserSubject.next(user);
    }
  }

  login(
    username: string,
    password: string,
    rememberMe: boolean
  ): Observable<boolean> {
    return this.http
      .post<{ success: boolean; user: User }>(
        'http://localhost/stronks/backend/login.php',
        { username, password }
      )
      .pipe(
        map((response) => {
          if (response.success && response.user) {
            if (rememberMe) {
              this.storage.set(this.USER_KEY, response.user);
            }
            this.currentUserSubject.next(response.user);
            return true;
          }
          return false;
        })
      );
  }

  async logout(): Promise<void> {
    this.currentUserSubject.next(null);
    await this.storage.remove(this.USER_KEY);
  }

  isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }
}
