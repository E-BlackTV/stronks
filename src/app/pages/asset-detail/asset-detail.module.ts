import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AssetDetailPageRoutingModule } from './asset-detail.routing';
import { AssetDetailPage } from './asset-detail.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, AssetDetailPageRoutingModule],
  declarations: [AssetDetailPage]
})
export class AssetDetailPageModule {} 