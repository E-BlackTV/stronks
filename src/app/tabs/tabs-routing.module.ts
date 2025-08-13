/**
 * Tabs Routing Module
 *
 * Dieses Modul definiert die Routen für die Tab-Navigation der Anwendung.
 * Es enthält alle Unterseiten, die innerhalb der Tab-Struktur angezeigt werden.
 * Die Tab-Navigation ist der Hauptnavigationsbereich für angemeldete Benutzer.
 */
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';
import { AuthGuard } from '../guards/auth.guard'; // Schützt Routen für angemeldete Benutzer
import { DebugComponent } from '../debug/debug.component';

/**
 * Tab-Routen der Anwendung
 *
 * Alle diese Routen werden als Kinder der TabsPage definiert und
 * erscheinen innerhalb der Tab-Navigation am unteren Bildschirmrand.
 */
const routes: Routes = [
  {
    path: '',
    component: TabsPage,  // Haupt-Container für die Tab-Navigation
    children: [
      {
        path: 'home',     // Startseite mit Portfolio-Übersicht
        loadChildren: () => import('../home/home.module').then(m => m.HomePageModule),
      },
      {
        path: 'tab2',     // Marktübersicht
        loadChildren: () => import('../tab2/tab2.module').then(m => m.Tab2PageModule),
      },
      {
        path: 'settings', // Einstellungen
        loadChildren: () => import('../settings/settings.module').then(m => m.SettingsPageModule),
      },
      {
        path: 'wallet',   // Wallet-Übersicht
        loadChildren: () => import('../pages/wallet/wallet.module').then(m => m.WalletPageModule),
      },
      {
        path: 'rewards',  // Tägliche Belohnungen (Glücksrad)
        canActivate: [AuthGuard],
        loadChildren: () => import('../pages/rewards/rewards.module').then(m => m.RewardsPageModule),
      },
      {
        path: 'asset/:symbol',  // Detailansicht für einzelne Assets
        canActivate: [AuthGuard],
        loadChildren: () => import('../pages/asset-detail/asset-detail.module').then(m => m.AssetDetailPageModule)
      },
      {
        path: '',         // Standardroute innerhalb der Tabs
        redirectTo: 'home',
        pathMatch: 'full',
      },
      {
        path: 'debug',    // Debug-Seite für Entwicklung
        component: DebugComponent,
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TabsPageRoutingModule {}
