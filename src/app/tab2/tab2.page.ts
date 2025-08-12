import { Component, HostListener, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { TradePopupComponent } from '../components/trade-popup/trade-popup.component';
import { TradingService } from '../services/trading.service';
import { Router } from '@angular/router';
import { FirestoreService, Asset, CachedData } from '../services/firestore.service';

interface ListAsset {
  type: 'crypto' | 'stock' | 'forex';
  symbol: string;
  name: string;
  price?: number;
  priceChange?: number;
  priceChangePercent?: number;
  sourceId?: string;
  lastUpdated?: Date;
}

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss']
})
export class Tab2Page implements OnInit {
   isMobile = false;
  assets: ListAsset[] = [];
  filteredAssets: ListAsset[] = [];
  selectedType: 'all' | 'crypto' | 'stock' | 'forex' = 'all';
  searchTerm: string = '';
  sortBy: 'name' | 'price' = 'name';
  sortDir: 'asc' | 'desc' = 'asc';

  cryptoCount = 0;
  stockCount = 0;
  latestPrices: Record<string, number> = {};
  loading = false;

  constructor(
    private modalController: ModalController,
    private tradingService: TradingService,
    private router: Router,
    private firestore: FirestoreService,
  ) {}

  ngOnInit() {
    this.checkScreenSize();
    this.loading = true;

    // Lade zuerst die Assets aus der assets-Collection
    this.firestore.getAssetsRealtime().subscribe((assets: Asset[]) => {
      const deduped = this.deduplicateBySymbol(assets);
      this.assets = deduped.map((a) => ({ type: a.type, symbol: a.symbol, name: a.name }));
      this.cryptoCount = this.assets.filter(a => a.type === 'crypto').length;
      this.stockCount = this.assets.filter(a => a.type === 'stock').length;

      console.log('Geladene Assets aus assets-Collection:', this.assets);

      // Lade dann die gecachten Daten
      this.loadCachedPrices();

      this.loading = false;
    });

    // Fallback: Wenn keine Assets geladen werden, lade direkt die gecachten Daten
    setTimeout(() => {
      if (this.assets.length === 0) {
        console.log('Keine Assets gefunden, lade direkt gecachte Daten...');
        this.loadCachedPrices();
        this.loading = false;
      }
    }, 3000);
  }

  @HostListener('window:resize')
  checkScreenSize() {
    this.isMobile = window.innerWidth < 500;
  }

  // Debug-Funktion: Zeige alle verfügbaren gecachten Daten für ein Symbol
  debugCachedData(symbol: string) {
    console.log(`Debug: Suche nach gecachten Daten für ${symbol}`);

    // Suche nach Daten, die dieses Symbol enthalten
    this.firestore.getCachedData().subscribe(
      (dataList) => {
        const relevantData = dataList.filter(data =>
          data.rows.some(row =>
            row.cells.some(cell =>
              cell && cell.toUpperCase().includes(symbol.toUpperCase())
            )
          )
        );

        if (relevantData.length > 0) {
          console.log(`Gefundene Daten für ${symbol}:`, relevantData);
        } else {
          console.log(`Keine Daten für ${symbol} gefunden`);
        }
      }
    );
  }

  // Debug-Funktion: Zeige alle verfügbaren gecachten Daten in der Datenbank
  debugAllCachedData() {
    console.log('Debug: Suche nach allen verfügbaren gecachten Daten...');

    // Lade alle verfügbaren Daten
    this.firestore.getCachedData().subscribe(
      (dataList) => {
        if (dataList && dataList.length > 0) {
          console.log('Alle verfügbaren gecachten Daten:', dataList);

          // Gruppiere nach Typ
          const byType = dataList.reduce((acc, data) => {
            if (!acc[data.type]) acc[data.type] = [];
            acc[data.type].push(data);
            return acc;
          }, {} as Record<string, CachedData[]>);

          console.log('Gruppiert nach Typ:', byType);

          // Zeige Details für jeden Typ
          Object.entries(byType).forEach(([type, dataList]) => {
            console.log(`${type.toUpperCase()} Daten (${dataList.length} Einträge):`);
            dataList.forEach(data => {
              console.log(`  - ${data.sourceId}: ${data.rows.length} Zeilen, aktualisiert: ${data.fetchedAt?.toDate?.()}`);
            });
          });

          // Wenn Daten vorhanden sind, lade sie neu
          if (Object.keys(byType).length > 0) {
            console.log('Gecachte Daten gefunden, lade sie neu...');
            this.loadCachedPrices();
          }
        } else {
          console.log('Keine gecachten Daten in der Datenbank gefunden');
          console.log('Mögliche Ursachen:');
          console.log('1. Die cached_data Collection existiert nicht');
          console.log('2. Die Collection ist leer');
          console.log('3. Die Firestore-Regeln blockieren den Zugriff');
          console.log('4. Die Datenstruktur stimmt nicht überein');
        }
      },
      (error) => {
        console.error('Fehler beim Laden der gecachten Daten:', error);
        console.log('Fehlerdetails:', error);
      }
    );
  }

  // Funktion: Daten manuell aktualisieren
  refreshData() {
    this.loading = true;
    console.log('Aktualisiere Daten...');

    // Lade alle Daten neu
    this.loadCachedPrices();

    setTimeout(() => {
      this.loading = false;
      console.log('Datenaktualisierung abgeschlossen');
    }, 2000);
  }

  // Funktion: Firestore-Verbindung testen
  testFirestoreConnection() {
    console.log('Teste Firestore-Verbindung...');

    // Teste den Zugriff auf eine einfache Collection
    this.firestore.getCachedData('crypto', 1).subscribe(
      (data) => {
        console.log('✅ Firestore-Verbindung funktioniert');
        console.log('Geladene Daten:', data);
      },
      (error) => {
        console.error('❌ Firestore-Verbindung fehlgeschlagen:', error);
        console.log('Fehlerdetails:', error);
      }
    );
  }

  // Funktion: Alle verfügbaren Collections überprüfen
  checkAllCollections() {
    console.log('Überprüfe alle verfügbaren Collections...');

    // Teste verschiedene Collection-Namen
    const collections = ['cached_data', 'assets', 'users', 'portfolios'];

    collections.forEach(collectionName => {
      console.log(`Teste Collection: ${collectionName}`);

      // Verwende eine einfache Abfrage für jede Collection
      this.firestore.getCachedData().subscribe(
        (data) => {
          console.log(`✅ ${collectionName}: ${data.length} Dokumente gefunden`);
        },
        (error) => {
          console.log(`❌ ${collectionName}: Fehler - ${error.message}`);
        }
      );
    });
  }

  // Funktion: Datenstruktur analysieren
  analyzeDataStructure() {
    console.log('Analysiere Datenstruktur...');

    this.firestore.getCachedData().subscribe(
      (dataList) => {
        if (dataList && dataList.length > 0) {
          console.log('=== DATENSTRUKTUR-ANALYSE ===');

          dataList.forEach((data, index) => {
            console.log(`\n--- Dokument ${index + 1} ---`);
            console.log('ID:', data.id);
            console.log('Source ID:', data.sourceId);
            console.log('Type:', data.type);
            console.log('URL:', data.url);
            console.log('Fetched At:', data.fetchedAt?.toDate?.());
            console.log('Rows Count:', data.rows?.length || 0);

            if (data.rows && data.rows.length > 0) {
              console.log('Erste Zeile (Headers):', data.rows[0].cells);
              if (data.rows.length > 1) {
                console.log('Zweite Zeile (Beispieldaten):', data.rows[1].cells);
              }
            }
          });
        } else {
          console.log('Keine Daten zum Analysieren gefunden');
        }
      },
      (error) => {
        console.error('Fehler beim Analysieren der Datenstruktur:', error);
      }
    );
  }

  private deduplicateBySymbol(list: Asset[]): Asset[] {
    const bySymbol = new Map<string, Asset>();
    list.forEach((item) => {
      const key = (item.symbol || '').toUpperCase();
      const existing = bySymbol.get(key);
      if (!existing) {
        bySymbol.set(key, item);
        return;
      }
      const getUpdatedAtMs = (a?: any) => {
        const ts = a?.updatedAt as any;
        if (!ts) return 0;
        if (typeof ts.toMillis === 'function') return ts.toMillis();
        if (typeof ts.seconds === 'number') return ts.seconds * 1000;
        return 0;
      };
      if (getUpdatedAtMs(item) >= getUpdatedAtMs(existing)) {
        bySymbol.set(key, item);
      }
    });
    return Array.from(bySymbol.values());
  }

  onTypeFilterChange() { this.applyFilters(); }
  onSearchChange() { this.applyFilters(); }

  applyFilters() {
    let filtered = [...this.assets];
    if (this.selectedType !== 'all') {
      filtered = filtered.filter(a => a.type === this.selectedType);
    }
    if (this.searchTerm.trim()) {
      const s = this.searchTerm.toLowerCase();
      filtered = filtered.filter(a => a.name.toLowerCase().includes(s) || a.symbol.toLowerCase().includes(s));
    }
    filtered.sort((a, b) => {
      if (this.sortBy === 'name') {
        const A = a.name.toLowerCase();
        const B = b.name.toLowerCase();
        return this.sortDir === 'asc' ? A.localeCompare(B) : B.localeCompare(A);
      } else {
        const pa = (this.latestPrices[a.symbol] ?? 0);
        const pb = (this.latestPrices[b.symbol] ?? 0);
        return this.sortDir === 'asc' ? pa - pb : pb - pa;
      }
    });
    this.filteredAssets = filtered;
  }

  private loadCachedPrices() {
    console.log('Lade gecachte Preise...');

    // Lade gecachte Preise für Krypto und Aktien
    this.loadCachedDataByType('crypto');
    this.loadCachedDataByType('stock');

    // Aktualisiere die gefilterte Liste nach dem Laden
    setTimeout(() => {
      this.applyFilters();
    }, 1000);
  }

  private loadCachedDataByType(type: 'crypto' | 'stock') {
    this.firestore.getLatestCachedData(type).subscribe(
      (cachedDataList: CachedData[]) => {
        console.log(`Geladene ${type}-Daten:`, cachedDataList);

        // Überprüfe die Datenstruktur vor der Verarbeitung
        const validData = cachedDataList.filter(data => this.validateCachedDataStructure(data));
        console.log(`Gültige ${type}-Daten:`, validData.length, 'von', cachedDataList.length);

        validData.forEach(cachedData => {
          this.processCachedData(cachedData);
        });
      },
      (error) => {
        console.error(`Fehler beim Laden der ${type}-Daten:`, error);
      }
    );
  }

  private validateCachedDataStructure(cachedData: CachedData): boolean {
    try {
      // Überprüfe grundlegende Eigenschaften
      if (!cachedData || typeof cachedData !== 'object') {
        console.warn('CachedData ist kein gültiges Objekt:', cachedData);
        return false;
      }

      if (!cachedData.sourceId || typeof cachedData.sourceId !== 'string') {
        console.warn('CachedData hat keine gültige sourceId:', cachedData);
        return false;
      }

      if (!cachedData.type || !['crypto', 'stock', 'generic'].includes(cachedData.type)) {
        console.warn('CachedData hat keinen gültigen Typ:', cachedData);
        return false;
      }

      if (!cachedData.rows || !Array.isArray(cachedData.rows)) {
        console.warn('CachedData hat keine gültigen rows:', cachedData);
        return false;
      }

      if (cachedData.rows.length < 2) {
        console.warn('CachedData hat nicht genügend Zeilen:', cachedData.rows.length);
        return false;
      }

      // Überprüfe die erste Zeile (Spaltenüberschriften)
      const firstRow = cachedData.rows[0];
      if (!firstRow || !firstRow.cells || !Array.isArray(firstRow.cells)) {
        console.warn('CachedData hat keine gültigen Spaltenüberschriften:', firstRow);
        return false;
      }

      if (firstRow.cells.length === 0) {
        console.warn('CachedData hat leere Spaltenüberschriften');
        return false;
      }

      // Überprüfe mindestens eine Datenzeile
      const dataRow = cachedData.rows[1];
      if (!dataRow || !dataRow.cells || !Array.isArray(dataRow.cells)) {
        console.warn('CachedData hat keine gültigen Datenzeilen:', dataRow);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Fehler bei der Validierung der CachedData-Struktur:', error);
      return false;
    }
  }

  private processCachedData(cachedData: CachedData) {
    try {
      console.log(`Verarbeite gecachte Daten für ${cachedData.sourceId}:`, cachedData);

      // Überprüfe, ob alle erforderlichen Eigenschaften vorhanden sind
      if (!cachedData || !cachedData.rows || !Array.isArray(cachedData.rows) || cachedData.rows.length < 2) {
        console.warn(`Keine ausreichenden Daten für ${cachedData.sourceId}:`, {
          hasData: !!cachedData,
          hasRows: !!cachedData?.rows,
          isArray: Array.isArray(cachedData?.rows),
          rowsLength: cachedData?.rows?.length
        });
        return;
      }

      // Erste Zeile enthält Spaltenüberschriften
      const headers = cachedData.rows[0]?.cells;
      if (!headers || !Array.isArray(headers)) {
        console.warn(`Keine gültigen Spaltenüberschriften für ${cachedData.sourceId}`);
        return;
      }

      console.log('Spalten:', headers);

      // Finde die relevanten Spalten
      const priceColumnIndex = this.findPriceColumnIndex(headers as any);
      const symbolColumnIndex = this.findSymbolColumnIndex(headers as any);
      const nameColumnIndex = this.findNameColumnIndex(headers as any);

      if (priceColumnIndex === -1) {
        console.warn(`Keine Preisspalte für ${cachedData.sourceId} gefunden`);
        return;
      }

      // Nur die letzte Datenzeile pro Quelle verwenden, um Mehrfach-Updates zu vermeiden
      const lastRow = cachedData.rows[cachedData.rows.length - 1];
      if (!lastRow || !Array.isArray(lastRow.cells)) {
        console.warn(`Ungültige letzte Zeile für ${cachedData.sourceId}:`, lastRow);
        return;
      }

      if (lastRow.cells.length > priceColumnIndex) {
        const priceStr = lastRow.cells[priceColumnIndex];
        if (!priceStr) {
          console.warn(`Kein Preis in letzter Zeile für ${cachedData.sourceId}`);
          return;
        }
        const price = parseFloat(priceStr);
        if (!isNaN(price) && price > 0) {
          // Extrahiere Symbol und Name
          let symbol = '';
          let name = '';

          if (symbolColumnIndex !== -1 && lastRow.cells[symbolColumnIndex]) {
            symbol = String(lastRow.cells[symbolColumnIndex]).toUpperCase();
          }
          if (nameColumnIndex !== -1 && lastRow.cells[nameColumnIndex]) {
            name = String(lastRow.cells[nameColumnIndex]);
          }

          // Wenn kein Symbol gefunden, verwende sourceId
          if (!symbol && cachedData.sourceId.startsWith('yahoo-')) {
            symbol = cachedData.sourceId.replace('yahoo-', '');
          } else if (!symbol && cachedData.sourceId.startsWith('binance-')) {
            symbol = cachedData.sourceId.replace('binance-', '');
          } else if (!symbol && cachedData.sourceId.startsWith('stooq-')) {
            symbol = cachedData.sourceId.replace('stooq-', '');
          }

          if (symbol) {
            this.updateAssetPrice(
              symbol,
              name,
              price,
              cachedData.type,
              cachedData.sourceId,
              cachedData.fetchedAt
            );
          } else {
            console.warn(`Kein Symbol in letzter Zeile für ${cachedData.sourceId} gefunden`);
          }
        } else {
          console.warn(`Ungültiger Preis in letzter Zeile für ${cachedData.sourceId}: ${priceStr}`);
        }
      } else {
        console.warn(`Letzte Zeile hat nicht genügend Spalten für ${cachedData.sourceId}`);
      }
    } catch (error) {
      console.error(`Fehler beim Verarbeiten der gecachten Daten für ${cachedData?.sourceId}:`, error);
      console.error('Datenstruktur:', cachedData);
    }
  }

  private findPriceColumnIndex(headers: string[]): number {
    const priceKeywords = ['price', 'close', 'last', 'current', 'value', 'kurs', 'zamkniecie'];
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toLowerCase();
      if (priceKeywords.some(keyword => header.includes(keyword))) {
        return i;
      }
    }
    return -1;
  }

  private findSymbolColumnIndex(headers: string[]): number {
    const symbolKeywords = ['symbol', 'ticker', 'code', 'abbreviation'];
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toLowerCase();
      if (symbolKeywords.some(keyword => header.includes(keyword))) {
        return i;
      }
    }
    return -1;
  }

  private findNameColumnIndex(headers: string[]): number {
    const nameKeywords = ['name', 'company', 'firma', 'unternehmen'];
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toLowerCase();
      if (nameKeywords.some(keyword => header.includes(keyword))) {
        return i;
      }
    }
    return -1;
  }

  private updateAssetPrice(symbol: string, name: string, price: number, type: string, sourceId: string, fetchedAt: any) {
    try {
      if (!symbol || !price || isNaN(price) || price <= 0) {
        console.warn(`Ungültige Daten für updateAssetPrice:`, { symbol, price, type, sourceId });
        return;
      }

      // Aktualisiere das Asset mit Preisinformationen
      let assetIndex = this.assets.findIndex(a => a.symbol === symbol);

      if (assetIndex === -1) {
        // Asset existiert nicht, füge es hinzu
        const newAsset: ListAsset = {
          type: type as 'crypto' | 'stock',
          symbol: symbol,
          name: name || symbol,
          price: price,
          sourceId: sourceId,
          lastUpdated: fetchedAt?.toDate?.() || new Date()
        };
        this.assets.push(newAsset);

        // Aktualisiere die Zähler
        if (type === 'crypto') this.cryptoCount++;
        if (type === 'stock') this.stockCount++;

        console.log(`Neues Asset hinzugefügt: ${symbol} (${type}) mit Preis ${price}`);
      } else {
        // Asset existiert, aktualisiere es
        this.assets[assetIndex].price = price;
        this.assets[assetIndex].sourceId = sourceId;
        this.assets[assetIndex].lastUpdated = fetchedAt?.toDate?.() || new Date();

        console.log(`Asset aktualisiert: ${symbol} mit neuem Preis ${price}`);
      }

      // Aktualisiere die Preise
      this.latestPrices[symbol] = price;

      // Aktualisiere die gefilterte Liste
      this.applyFilters();
    } catch (error) {
      console.error(`Fehler beim Aktualisieren des Asset-Preises für ${symbol}:`, error);
    }
  }

  async openAsset(asset: ListAsset) {
    const price = this.latestPrices[asset.symbol] || 0;
    const modal = await this.modalController.create({
      component: TradePopupComponent,
      componentProps: {
        action: 'buy',
        assetSymbol: asset.symbol,
        currentPrice: price,
        userBalance: 0,
        availableQuantity: 0,
      },
    });
    await modal.present();
  }

  goToDetail(asset: ListAsset) { this.router.navigate(['/wallet/asset-detail', asset.symbol]); }
}
