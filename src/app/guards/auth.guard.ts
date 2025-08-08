import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { FirebaseAdminService } from '../services/firebase-admin.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(
    private firebaseService: FirebaseAdminService,
    private router: Router
  ) {}

  canActivate(): boolean {
    if (!this.firebaseService.isLoggedIn()) {
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: window.location.pathname },
      });
      return false;
    }
    return true;
  }
}
