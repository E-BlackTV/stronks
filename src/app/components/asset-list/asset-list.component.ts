import { Component, OnInit, OnDestroy } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { FirestoreService, Asset } from '../../services/firestore.service';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-asset-list',
  templateUrl: './asset-list.component.html',
  styleUrls: ['./asset-list.component.scss']
})
export class AssetListComponent implements OnInit, OnDestroy {
  
  // Observable für reaktive Daten
  assets$: Observable<Asset[]>;
  
  // Lokale Daten für Filterung
  assets: Asset[] = [];
  filteredAssets: Asset[] = [];
  
  // Filter-Properties
  selectedType: 'all' | 'crypto' | 'stock' | 'forex' = 'all';
  searchTerm: string = '';
  
  // Loading States
  isLoading: boolean = false;
  
  // Subscriptions für Cleanup
  private subscriptions: Subscription[] = [];

  constructor(
    private firestoreService: FirestoreService,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.loadAssets();
  }

  ngOnDestroy() {
    // Cleanup Subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Lädt Assets aus Firestore
   */
  async loadAssets() {
    this.isLoading = true;
    
    try {
      // Verwende Echtzeit-Updates für reaktive Daten
      this.assets$ = this.firestoreService.getAssetsRealtime();
      
      // Subscribe für lokale Filterung
      const subscription = this.assets$.subscribe(assets => {
        this.assets = assets;
        this.applyFilters();
        this.isLoading = false;
      });
      
      this.subscriptions.push(subscription);
      
    } catch (error) {
      console.error('Fehler beim Laden der Assets:', error);
      this.showError('Fehler beim Laden der Assets');
      this.isLoading = false;
    }
  }

  /**
   * Lädt Assets nach Typ
   */
  async loadAssetsByType(type: 'crypto' | 'stock' | 'forex') {
    this.isLoading = true;
    
    try {
      this.assets$ = this.firestoreService.getAssetsByType(type);
      
      const subscription = this.assets$.subscribe(assets => {
        this.assets = assets;
        this.applyFilters();
        this.isLoading = false;
      });
      
      this.subscriptions.push(subscription);
      
    } catch (error) {
      console.error('Fehler beim Laden der Assets:', error);
      this.showError('Fehler beim Laden der Assets');
      this.isLoading = false;
    }
  }

  /**
   * Wendet Filter an
   */
  applyFilters() {
    let filtered = [...this.assets];

    // Typ-Filter
    if (this.selectedType !== 'all') {
      filtered = filtered.filter(asset => asset.type === this.selectedType);
    }

    // Such-Filter
    if (this.searchTerm.trim()) {
      const searchLower = this.searchTerm.toLowerCase();
      filtered = filtered.filter(asset => 
        asset.symbol.toLowerCase().includes(searchLower) ||
        asset.name.toLowerCase().includes(searchLower)
      );
    }

    this.filteredAssets = filtered;
  }

  /**
   * Filter-Änderung Handler
   */
  onTypeFilterChange() {
    if (this.selectedType === 'all') {
      this.loadAssets();
    } else {
      this.loadAssetsByType(this.selectedType);
    }
  }

  /**
   * Such-Filter Handler
   */
  onSearchChange() {
    this.applyFilters();
  }

  /**
   * Asset-Details anzeigen
   */
  async showAssetDetails(asset: Asset) {
    const alert = await this.alertController.create({
      header: asset.name,
      subHeader: asset.symbol,
      message: `
        <strong>Typ:</strong> ${asset.type}<br>
        <strong>Status:</strong> ${asset.isActive ? 'Aktiv' : 'Inaktiv'}<br>
        <strong>Erstellt:</strong> ${asset.createdAt.toDate().toLocaleDateString()}<br>
        <strong>Aktualisiert:</strong> ${asset.updatedAt.toDate().toLocaleDateString()}
      `,
      buttons: [
        {
          text: 'Schließen',
          role: 'cancel'
        },
        {
          text: 'Bearbeiten',
          handler: () => this.editAsset(asset)
        }
      ]
    });

    await alert.present();
  }

  /**
   * Asset bearbeiten
   */
  async editAsset(asset: Asset) {
    const alert = await this.alertController.create({
      header: 'Asset bearbeiten',
      inputs: [
        {
          name: 'name',
          type: 'text',
          value: asset.name,
          placeholder: 'Asset Name'
        },
        {
          name: 'symbol',
          type: 'text',
          value: asset.symbol,
          placeholder: 'Symbol'
        },
        {
          name: 'type',
          type: 'select',
          value: asset.type,
          options: [
            { value: 'crypto', label: 'Kryptowährung' },
            { value: 'stock', label: 'Aktie' },
            { value: 'forex', label: 'Forex' }
          ]
        }
      ],
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Speichern',
          handler: (data) => this.updateAsset(asset.id!, data)
        }
      ]
    });

    await alert.present();
  }

  /**
   * Asset aktualisieren
   */
  async updateAsset(assetId: string, updates: Partial<Asset>) {
    const loading = await this.loadingController.create({
      message: 'Asset wird aktualisiert...'
    });
    await loading.present();

    try {
      await this.firestoreService.updateAsset(assetId, updates).toPromise();
      this.showSuccess('Asset erfolgreich aktualisiert');
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Assets:', error);
      this.showError('Fehler beim Aktualisieren des Assets');
    } finally {
      await loading.dismiss();
    }
  }

  /**
   * Neues Asset erstellen
   */
  async createAsset() {
    const alert = await this.alertController.create({
      header: 'Neues Asset erstellen',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Asset Name',
          required: true
        },
        {
          name: 'symbol',
          type: 'text',
          placeholder: 'Symbol (z.B. BTC-USD)',
          required: true
        },
        {
          name: 'type',
          type: 'select',
          placeholder: 'Typ auswählen',
          options: [
            { value: 'crypto', label: 'Kryptowährung' },
            { value: 'stock', label: 'Aktie' },
            { value: 'forex', label: 'Forex' }
          ],
          required: true
        }
      ],
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Erstellen',
          handler: (data) => this.saveNewAsset(data)
        }
      ]
    });

    await alert.present();
  }

  /**
   * Neues Asset speichern
   */
  async saveNewAsset(assetData: any) {
    const loading = await this.loadingController.create({
      message: 'Asset wird erstellt...'
    });
    await loading.present();

    try {
      const newAsset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'> = {
        name: assetData.name,
        symbol: assetData.symbol.toUpperCase(),
        type: assetData.type,
        isActive: true
      };

      await this.firestoreService.createAsset(newAsset).toPromise();
      this.showSuccess('Asset erfolgreich erstellt');
    } catch (error) {
      console.error('Fehler beim Erstellen des Assets:', error);
      this.showError('Fehler beim Erstellen des Assets');
    } finally {
      await loading.dismiss();
    }
  }

  /**
   * Asset löschen (Soft Delete)
   */
  async deleteAsset(asset: Asset) {
    const alert = await this.alertController.create({
      header: 'Asset löschen',
      message: `Möchten Sie das Asset "${asset.name}" wirklich löschen?`,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: () => this.confirmDeleteAsset(asset)
        }
      ]
    });

    await alert.present();
  }

  /**
   * Asset-Löschung bestätigen
   */
  async confirmDeleteAsset(asset: Asset) {
    const loading = await this.loadingController.create({
      message: 'Asset wird gelöscht...'
    });
    await loading.present();

    try {
      await this.firestoreService.deleteAsset(asset.id!).toPromise();
      this.showSuccess('Asset erfolgreich gelöscht');
    } catch (error) {
      console.error('Fehler beim Löschen des Assets:', error);
      this.showError('Fehler beim Löschen des Assets');
    } finally {
      await loading.dismiss();
    }
  }

  /**
   * Asset zu Portfolio hinzufügen
   */
  async addToPortfolio(asset: Asset) {
    const alert = await this.alertController.create({
      header: 'Zu Portfolio hinzufügen',
      inputs: [
        {
          name: 'quantity',
          type: 'number',
          placeholder: 'Menge',
          min: 0.01,
          step: 0.01,
          required: true
        },
        {
          name: 'price',
          type: 'number',
          placeholder: 'Kaufpreis pro Stück',
          min: 0.01,
          step: 0.01,
          required: true
        }
      ],
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Hinzufügen',
          handler: (data) => this.saveToPortfolio(asset, data)
        }
      ]
    });

    await alert.present();
  }

  /**
   * Asset zu Portfolio speichern
   */
  async saveToPortfolio(asset: Asset, data: any) {
    const loading = await this.loadingController.create({
      message: 'Asset wird zum Portfolio hinzugefügt...'
    });
    await loading.present();

    try {
      // Hier würde die Portfolio-Logik implementiert
      // this.firestoreService.addAssetToPortfolio(portfolioId, portfolioAsset);
      this.showSuccess('Asset zum Portfolio hinzugefügt');
    } catch (error) {
      console.error('Fehler beim Hinzufügen zum Portfolio:', error);
      this.showError('Fehler beim Hinzufügen zum Portfolio');
    } finally {
      await loading.dismiss();
    }
  }

  /**
   * Erfolgs-Nachricht anzeigen
   */
  async showSuccess(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      color: 'success',
      position: 'top'
    });
    await toast.present();
  }

  /**
   * Fehler-Nachricht anzeigen
   */
  async showError(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      color: 'danger',
      position: 'top'
    });
    await toast.present();
  }

  /**
   * Asset-Statistiken abrufen
   */
  async showAssetStats() {
    try {
      const stats = await this.firestoreService.getAssetStats().toPromise();
      
      const alert = await this.alertController.create({
        header: 'Asset-Statistiken',
        message: `
          <strong>Gesamt:</strong> ${stats.total} Assets<br>
          <strong>Kryptowährungen:</strong> ${stats.byType.crypto || 0}<br>
          <strong>Aktien:</strong> ${stats.byType.stock || 0}<br>
          <strong>Forex:</strong> ${stats.byType.forex || 0}
        `,
        buttons: ['Schließen']
      });

      await alert.present();
    } catch (error) {
      console.error('Fehler beim Laden der Statistiken:', error);
      this.showError('Fehler beim Laden der Statistiken');
    }
  }

  /**
   * Refresh-Funktion
   */
  async refresh() {
    await this.loadAssets();
  }
} 