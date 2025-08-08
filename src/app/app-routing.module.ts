import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { DebugComponent } from './debug/debug.component';

const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./register/register.module').then((m) => m.RegisterPageModule),
  },
  {
    path: 'wallet',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('./tabs/tabs.module').then((m) => m.TabsPageModule),
  },
  {
    path: 'home',
    loadChildren: () =>
      import('./home/home.module').then((m) => m.HomePageModule),
    canActivate: [AuthGuard],
  },
  {
    path: 'asset/:symbol',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/asset-detail/asset-detail.module').then(m => m.AssetDetailPageModule)
  },
  {
    path: 'rewards',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/rewards/rewards.module').then(m => m.RewardsPageModule)
  },
  {
    path: 'login',
    loadChildren: () =>
      import('./login/login.module').then((m) => m.LoginPageModule),
  },
  {
    path: 'register',
    loadChildren: () =>
      import('./register/register.module').then((m) => m.RegisterPageModule),
  },
  {
    path: 'debug',
    component: DebugComponent,
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
