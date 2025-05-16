import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { LuckyWheelComponent } from './lucky-wheel.component';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    FormsModule
  ],
  declarations: [LuckyWheelComponent],
  exports: [LuckyWheelComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class LuckyWheelModule { }