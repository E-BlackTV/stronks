import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { map } from 'rxjs/operators';

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
  private readonly USER_KEY = 'currentUser';
  private apiUrl = 'https://web053.wifiooe.at/backend'; // Direkte Server-Verbindung

  constructor(private http: HttpClient, private router: Router) {
    const storedUser = localStorage.getItem(this.USER_KEY);
    this.currentUserSubject = new BehaviorSubject<User | null>(
      storedUser ? JSON.parse(storedUser) : null
    );
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  login(username: string, password: string): Observable<boolean> {
    return this.http
      .post<any>(`${this.apiUrl}/login.php`, {
        username,
        password,
      })
      .pipe(
        map((response) => {
          if (response.success && response.user) {
            localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
            this.currentUserSubject.next(response.user);
            return true;
          }
          return false;
        })
      );
  }

  logout() {
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return this.currentUserValue !== null;
  }

  getCurrentUser(): User | null {
    return this.currentUserValue;
  }
}
