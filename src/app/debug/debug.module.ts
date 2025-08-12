import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TradePopupModule } from '../components/trade-popup/trade-popup.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TradePopupModule,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class DebugPageModule {}
