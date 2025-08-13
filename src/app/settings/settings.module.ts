import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { SettingsPageRoutingModule } from './settings-routing.module';
import { SettingsPage } from './settings.page';

/**
 * Einstellungen Modul
 *
 * Dieses Modul enthält die Einstellungsseite, auf der Benutzer ihre Profileinstellungen
 * verwalten können, einschließlich der Änderung des Benutzernamens, der E-Mail-Adresse
 * und des Passworts.
 */
@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule, // Für die Formularvalidierung
    IonicModule,
    SettingsPageRoutingModule
  ],
  declarations: [SettingsPage],
})
export class SettingsPageModule {}
