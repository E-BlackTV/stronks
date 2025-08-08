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
    // Verwende Firebase Authentication anstelle der PHP-API
    // Für jetzt verwenden wir eine einfache lokale Authentifizierung
    // In einer echten Implementierung würden Sie Firebase Auth verwenden
    
    // Simuliere eine erfolgreiche Anmeldung für Demo-Zwecke
    const mockUser: User = {
      id: 1,
      username: username,
      accountbalance: 10000
    };
    
    return of(true).pipe(
      map(() => {
        localStorage.setItem(this.USER_KEY, JSON.stringify(mockUser));
        this.currentUserSubject.next(mockUser);
        return true;
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
