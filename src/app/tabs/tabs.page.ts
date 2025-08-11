import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { LuckyWheelComponent } from '../components/lucky-wheel/lucky-wheel.component';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss']
})
export class TabsPage {

  constructor(private modalController: ModalController) {}

  async openLuckyWheel() {
    const modal = await this.modalController.create({
      component: LuckyWheelComponent,
      componentProps: {},
      cssClass: 'lucky-wheel-modal'
    });
    return await modal.present();
  }
}
