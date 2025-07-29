import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TradePopupComponent } from './trade-popup.component';

@NgModule({
  declarations: [TradePopupComponent],
  imports: [CommonModule, ReactiveFormsModule, IonicModule],
  exports: [TradePopupComponent],
})
export class TradePopupModule {}
