import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RewardsPageRoutingModule } from './rewards.routing';
import { RewardsPage } from './rewards.page';

@NgModule({
  imports: [CommonModule, IonicModule, RewardsPageRoutingModule],
  declarations: [RewardsPage],
})
export class RewardsPageModule {}
