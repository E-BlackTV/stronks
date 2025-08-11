import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AssetDetailPage } from './asset-detail.page';

const routes: Routes = [
  { path: '', component: AssetDetailPage }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AssetDetailPageRoutingModule {} 