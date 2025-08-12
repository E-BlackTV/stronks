import { Component, NgModule, OnInit } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes, ActivatedRoute, Router } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { DebugComponent } from './debug/debug.component';

@Component({
  template: ''
})
export class AssetRedirectComponent implements OnInit {
  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    const symbol = this.route.snapshot.paramMap.get('symbol');
    if (symbol) {
      this.router.navigate(['/wallet/asset', symbol]);
    } else {
      this.router.navigate(['/wallet/home']);
    }
  }
}

const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
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
    component: AssetRedirectComponent
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
  declarations: [AssetRedirectComponent],
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
