import { Injectable } from '@angular/core';
import { MenuController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  isMenuCollapsed = false;

  constructor(private menu: MenuController) {
    const saved = localStorage.getItem('menuCollapsed');
    this.isMenuCollapsed = saved === '1';
  }

  toggleMenuCollapsed() {
    this.isMenuCollapsed = !this.isMenuCollapsed;
    if (this.isMenuCollapsed) {
      this.menu.close();
    } else {
      this.menu.open();
    }
    localStorage.setItem('menuCollapsed', this.isMenuCollapsed ? '1' : '0');
  }
}
