import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthenticationService } from '../services/authentication.service';
import { Observable } from 'rxjs';
import { tap, map, take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthenticationService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean> {
    return this.authService.isLoggedIn().pipe(
      take(1), // einmal subscriben und danach completes
      tap((loggedIn) => {
        if (!loggedIn) {
          this.router.navigate(['/login']);
        }
      }),
      map((loggedIn) => loggedIn)
    );
  }
}

