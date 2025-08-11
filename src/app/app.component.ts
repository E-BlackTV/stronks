import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FirebaseAdminService } from './services/firebase-admin.service';
import { FirestoreService } from './services/firestore.service';
import { MenuService } from './services/menuService.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})

export class AppComponent implements OnInit {
  
  isMenuCollapsed = false;
  menuBalance = 0;

  constructor(
    public menuService: MenuService,
    private router: Router,
    private firebaseService: FirebaseAdminService,
    private firestore: FirestoreService,
  ) {}

  ngOnInit() {
    const saved = localStorage.getItem('menuCollapsed');
    this.isMenuCollapsed = saved === '1';

    const user = this.firebaseService.getCurrentUser();
    if (user?.id) {
      this.firestore.getUserBalance(user.id).subscribe((b) => (this.menuBalance = b || 0));
    }
  }

  get isAuthRoute(): boolean {
    const url = this.router.url.split('?')[0];
    return url === '/' || url.startsWith('/login') || url.startsWith('/register');
  }

  toggleMenuCollapsed() {
    this.isMenuCollapsed = !this.isMenuCollapsed;
    localStorage.setItem('menuCollapsed', this.isMenuCollapsed ? '1' : '0');
  }

  async logout() {
    try {
      await this.firebaseService.logout();
    } finally {
      this.router.navigate(['/login']);
    }
  }
}
