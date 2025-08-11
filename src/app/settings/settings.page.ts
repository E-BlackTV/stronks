import { Component } from '@angular/core';
import { FirebaseAdminService } from '../services/firebase-admin.service';
import { FirestoreService } from '../services/firestore.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage {
    constructor(
    private router: Router,
    private firebaseService: FirebaseAdminService,
    private firestore: FirestoreService,
  ) {}

  async logout() {
    try {
      await this.firebaseService.logout();
    } finally {
      this.router.navigate(['/login']);
    }
  }
} 