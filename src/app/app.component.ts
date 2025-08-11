import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FirebaseAdminService } from './services/firebase-admin.service';
import { FirestoreService } from './services/firestore.service';
import { MenuService } from './services/menuService.service';
import { AuthenticationService } from './services/authentication.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})

export class AppComponent implements OnInit {
  
  menuBalance = 0;

  constructor(
    public menuService: MenuService,
    private router: Router,
    private firebaseService: FirebaseAdminService,
    private firestore: FirestoreService,
    private authService: AuthenticationService,
  ) {}

  ngOnInit() {
    // Prüfe den Authentifizierungsstatus
    this.authService.user$.subscribe(user => {
      if (user) {
        // Benutzer ist angemeldet
        this.firestore.getUserBalance(user.uid).subscribe((b) => (this.menuBalance = b || 0));
        
        // Wenn wir auf der Login- oder Register-Seite sind, zur Wallet-Seite weiterleiten
        const currentUrl = this.router.url;
        if (currentUrl === '/login' || currentUrl === '/register' || currentUrl === '/') {
          this.router.navigate(['/wallet']);
        }
      } else {
        // Benutzer ist nicht angemeldet
        const currentUrl = this.router.url;
        if (currentUrl !== '/login' && currentUrl !== '/register' && currentUrl !== '/') {
          this.router.navigate(['/login']);
        }
      }
    });
  }

  get isAuthRoute(): boolean {
    const url = this.router.url.split('?')[0];
    return url === '/' || url.startsWith('/login') || url.startsWith('/register');
  }

  async logout() {
    try {
      await this.firebaseService.logout();
    } finally {
      this.router.navigate(['/login']);
    }
  }
}
