import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';
import { AuthGuard } from '../guards/auth.guard'; // falls benötigt

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'home',
        loadChildren: () => import('../home/home.module').then(m => m.HomePageModule),
      },
      {
        path: 'tab2',
        loadChildren: () => import('../tab2/tab2.module').then(m => m.Tab2PageModule),
      },
      {
        path: 'settings',
        loadChildren: () => import('../settings/settings.module').then(m => m.SettingsPageModule),
      },
      {
        path: 'wallet',
        loadChildren: () => import('../pages/wallet/wallet.module').then(m => m.WalletPageModule),
      },
      {
        path: 'rewards',
        canActivate: [AuthGuard],
        loadChildren: () => import('../pages/rewards/rewards.module').then(m => m.RewardsPageModule),
      },
      {
        path: 'asset-detail/:symbol',
        loadChildren: () => import('../pages/asset-detail/asset-detail.module').then(m => m.AssetDetailPageModule),
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TabsPageRoutingModule {}
