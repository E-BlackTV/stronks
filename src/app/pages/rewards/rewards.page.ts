import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { LuckyWheelComponent } from '../../components/lucky-wheel/lucky-wheel.component';

@Component({
  selector: 'app-rewards',
  templateUrl: './rewards.page.html',
  styleUrls: ['./rewards.page.scss']
})
export class RewardsPage {
  constructor(private modalController: ModalController) {}

  async openLuckyWheel() {
    const modal = await this.modalController.create({
      component: LuckyWheelComponent
    });
    await modal.present();
  }
} 