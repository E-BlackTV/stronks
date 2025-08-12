import { Injectable } from '@angular/core';
import { Observable, map, switchMap, of, combineLatest, catchError } from 'rxjs';
import { FirestoreService } from './firestore.service';
import { MarketDataService } from './market-data.service';

export interface TradeRequest {
  userId: string;
  assetSymbol: string;
  quantity: number;
  amount: number;
  currentPrice: number;
  action: 'buy' | 'sell';
}

export interface TradeResponse {
  success: boolean;
  message: string;
}

export interface PortfolioResponse {
  success: boolean;
  assets: any[];
  totalValue: number;
  cashBalance: number;
}

export interface TransactionsResponse {
  success: boolean;
  transactions: any[];
}

export interface BalanceResponse {
  success: boolean;
  balance: number;
}

@Injectable({ providedIn: 'root' })
export class TradingService {
  constructor(
    public firestoreService: FirestoreService,
    private marketData: MarketDataService,
  ) {}

  // Buy/Sell via Firestore
  trade(request: TradeRequest): Observable<TradeResponse> {
    const sign = request.action === 'buy' ? 1 : -1;
    const amountDelta = sign * request.amount;
    const quantityDelta = sign * request.quantity;

    return this.firestoreService.getUserBalance(request.userId).pipe(
      switchMap((balance) => {
        if (request.action === 'buy' && balance < request.amount) {
          return of({ success: false, message: 'Insufficient balance' });
        }
        const newBalance = request.action === 'buy' ? balance - request.amount : balance + request.amount;
        return this.firestoreService.updateUserBalance(request.userId, newBalance).pipe(
          switchMap(() =>
            this.firestoreService.upsertPortfolioAsset({
              userId: request.userId,
              symbol: request.assetSymbol,
              quantityDelta,
              amountDelta,
              currentPrice: request.currentPrice,
            })
          ),
          // Portfolio.cashBalance synchron mitführen
          switchMap(() => this.firestoreService.setPortfolioCashBalance(request.userId, newBalance).pipe(catchError(() => of(void 0)))),
          switchMap(() =>
            this.firestoreService.addTransaction({
              userId: request.userId,
              assetSymbol: request.assetSymbol,
              quantity: request.quantity,
              amount: request.amount,
              action: request.action,
              currentPrice: request.currentPrice,
            })
          ),
          map(() => ({ success: true, message: `${request.action} executed successfully` }))
        );
      })
    );
  }

  // Portfolio abrufen (+ CashBalance direkt verknüpft)
  getPortfolio(userId: string): Observable<PortfolioResponse> {
    return combineLatest([
      this.firestoreService.getPortfolioByUserId(userId),
      this.firestoreService.getUserBalance(userId),
    ]).pipe(
      map(([data, balance]) => {
        const assets = data?.assets ?? [];
        const totalValue = assets.reduce((sum: number, a: any) => sum + (a.quantity * (a.currentPrice || 0)), 0);
        return { success: true, assets, totalValue, cashBalance: balance };
      })
    );
  }

  // Balance abrufen
  getBalance(userId: string): Observable<BalanceResponse> {
    return this.firestoreService.getUserBalance(userId).pipe(
      map((balance) => ({ success: true, balance }))
    );
  }

  // Transaktionen abrufen
  getTransactions(userId: string, limit: number = 50, _offset: number = 0): Observable<TransactionsResponse> {
    return this.firestoreService.getTransactions(userId, limit).pipe(
      map((transactions) => ({ success: true, transactions }))
    );
  }

  // Asset-Preis (aus cached_data; falls nicht vorhanden, leer zurück)
  getAssetPrice(symbol: string): Observable<any> {
    // Suche nach gecachten Daten für dieses Symbol
    return this.firestoreService.getCachedData().pipe(
      map((cachedDataList) => {
        const upperSym = symbol.toUpperCase();
        // Finde Daten anhand der Tabelleninhalte (mit Guards)
        let relevantData = cachedDataList.find((data) =>
          Array.isArray((data as any)?.rows) &&
          (data as any).rows.some((row: any) =>
            Array.isArray(row?.cells) &&
            row.cells.some((cell: any) =>
              typeof cell === 'string' && cell.toUpperCase().includes(upperSym)
            )
          )
        );

        // Fallback: anhand der sourceId (z. B. "yahoo-AAPL")
        if (!relevantData) {
          relevantData = cachedDataList.find((d: any) =>
            typeof d?.sourceId === 'string' && d.sourceId.toUpperCase().includes(upperSym)
          );
        }

        if (!relevantData) return { success: false };

        // Extrahiere den Preis aus den Tabellendaten (robust)
        const price = this.extractPriceFromCachedData(relevantData);
        return price ? { success: true, price, symbol } : { success: false };
      })
    );
  }

  // Chart-Daten (aus cached_data)
  getChartData(symbol: string, range: string = '1d', interval: string = '5m'): Observable<any> {
    // Erstelle eine eindeutige sourceId für das Caching
    const sourceId = `chart-${symbol}-${range}-${interval}`;
    const type = symbol.includes('-USD') ? 'crypto' : 'stock';

    // Prüfe zuerst, ob Daten im Cache vorhanden sind
    return this.firestoreService.getCachedDataBySource(sourceId).pipe(
      switchMap(cachedData => {
        // Wenn Daten im Cache vorhanden sind
        if (cachedData && cachedData.rows && cachedData.rows.length > 1) {
          console.log(`Verwende gecachte Daten für ${symbol} (${range}, ${interval})`);

          // Prüfe, ob die Daten aktuell sind (nicht älter als 15 Minuten für kurze Zeiträume, 1 Stunde für längere)
          const maxAgeMinutes = ['1d', '1w'].includes(range) ? 15 : 60;
          const fetchedAt = cachedData.fetchedAt?.toMillis() || 0;
          const now = Date.now();
          const ageMinutes = (now - fetchedAt) / (1000 * 60);

          if (ageMinutes < maxAgeMinutes) {
            // Daten sind aktuell, konvertiere sie in das Chart-Format
            const chartData = this.convertCachedDataToChart(cachedData, range);
            if (chartData?.chart?.result?.[0]) {
              return of(chartData);
            }
          }

          // Daten sind veraltet, hole nur die neuesten Daten seit dem letzten Abruf
          // und füge sie zu den gecachten Daten hinzu
          const lastTimestamp = this.getLastTimestampFromCache(cachedData);
          if (lastTimestamp) {
            // Implementierung für inkrementelles Update fehlt in den APIs
            // Daher holen wir vorerst die kompletten Daten neu
            console.log(`Aktualisiere Daten für ${symbol} seit ${new Date(lastTimestamp * 1000).toISOString()}`);
          }
        }

        // Keine (aktuellen) Daten im Cache, hole sie von den APIs
        console.log(`Hole neue Daten für ${symbol} (${range}, ${interval})`);

        // Direkter Live-Fetch: zuerst CoinGecko (für Krypto), dann Alpha Vantage (für Aktien), dann Yahoo als Fallback
        return this.fetchAndCacheChartData(symbol, range, interval, sourceId, type);
      })
    );
  }

  // Hilfsmethode zum Abrufen und Cachen von Daten
  private fetchAndCacheChartData(symbol: string, range: string, interval: string, sourceId: string, type: 'crypto' | 'stock'): Observable<any> {
    // Wähle die passende API basierend auf dem Asset-Typ
    const fetchObservable = type === 'crypto'
      ? this.marketData.fetchCryptoChart(symbol, range, interval)
      : this.marketData.fetchStockChart(symbol, range, interval);

    return fetchObservable.pipe(
      switchMap(response => {
        if (response?.data?.chart?.result?.[0]) {
          // Cache die Daten
          this.cacheChartData(response.data, sourceId, type, symbol, range, interval);
          return of(response.data);
        }

        // Fallback auf Yahoo für beide Typen
        return this.marketData.fetchYahooChart(symbol, range, interval).pipe(
          switchMap(yhRes => {
            if (yhRes?.data?.chart?.result?.[0]) {
              this.cacheChartData(yhRes.data, sourceId, type, symbol, range, interval);
              return of(yhRes.data);
            }

            // Weitere Fallbacks nur für Aktien
            if (type === 'stock') {
              return this.marketData.fetchStockChartStooq(symbol, range, interval).pipe(
                switchMap(stqRes => {
                  if (stqRes?.data?.chart?.result?.[0]) {
                    this.cacheChartData(stqRes.data, sourceId, type, symbol, range, interval);
                    return of(stqRes.data);
                  }

                  return this.marketData.fetchStockChartFmp(symbol, range, interval).pipe(
                    switchMap(fmpRes => {
                      if (fmpRes?.data?.chart?.result?.[0]) {
                        this.cacheChartData(fmpRes.data, sourceId, type, symbol, range, interval);
                        return of(fmpRes.data);
                      }

                      // Keine Daten gefunden
                      return of({ chart: { result: [] } });
                    })
                  );
                })
              );
            }

            // Keine Daten gefunden
            return of({ chart: { result: [] } });
          })
        );
      })
    );
  }

  // Hilfsmethode zum Cachen von Chart-Daten
  private cacheChartData(data: any, sourceId: string, type: 'crypto' | 'stock', symbol: string, range: string, interval: string): void {
    if (!data?.chart?.result?.[0]) return;

    const result = data.chart.result[0];
    const timestamps = result.timestamp || [];
    const prices = result.indicators?.quote?.[0]?.close || [];
    const volumes = result.indicators?.quote?.[0]?.volume || [];

    if (timestamps.length === 0 || prices.length === 0) return;

    // Erstelle Tabellendaten für das Caching
    const rows = [
      { cells: ['timestamp', 'price', 'volume'] } // Header
    ];

    // Füge Datenzeilen hinzu
    for (let i = 0; i < timestamps.length; i++) {
      if (i < prices.length) {
        const timestamp = timestamps[i];
        const price = prices[i];
        const volume = i < volumes.length ? volumes[i] : 0;

        rows.push({
          cells: [
            timestamp.toString(),
            price.toString(),
            volume.toString()
          ]
        });
      }
    }

    // Speichere die Daten in Firestore
    const url = `chart/${symbol}/${range}/${interval}`;
    this.firestoreService.upsertCachedData({
      sourceId,
      type,
      url,
      rows
    }).subscribe({
      next: () => console.log(`Daten für ${symbol} (${range}, ${interval}) erfolgreich gecacht`),
      error: err => console.error(`Fehler beim Cachen der Daten für ${symbol}:`, err)
    });
  }

  // Hilfsmethode zum Extrahieren des letzten Zeitstempels aus gecachten Daten
  private getLastTimestampFromCache(cachedData: any): number | null {
    if (!cachedData?.rows || cachedData.rows.length < 2) return null;

    // Finde die Zeitstempel-Spalte
    const headers = cachedData.rows[0]?.cells || [];
    const timeColumnIndex = headers.findIndex((h: string) =>
      h.toLowerCase().includes('time') || h.toLowerCase().includes('date') || h.toLowerCase() === 'timestamp'
    );

    if (timeColumnIndex === -1) return null;

    // Hole den letzten Zeitstempel
    const lastRow = cachedData.rows[cachedData.rows.length - 1];
    if (!lastRow?.cells || lastRow.cells.length <= timeColumnIndex) return null;

    const timestampStr = lastRow.cells[timeColumnIndex];
    const timestamp = parseInt(timestampStr, 10);
    return isNaN(timestamp) ? null : timestamp;
  }

  // Extrahiert den Preis aus gecachten Daten
  private extractPriceFromCachedData(cachedData: any): number | null {
    try {
      if (!cachedData || !Array.isArray(cachedData.rows) || cachedData.rows.length < 2) return null;

      // Erste Zeile enthält Spaltenüberschriften
      const headers = Array.isArray(cachedData.rows[0]?.cells) ? (cachedData.rows[0].cells as string[]) : [];
      if (headers.length === 0) return null;

      // Finde die Preisspalte
      const priceColumnIndex = this.findPriceColumnIndex(headers);
      if (priceColumnIndex === -1) return null;

      // Nimm den neuesten Preis (letzte Zeile)
      const lastRow = cachedData.rows[cachedData.rows.length - 1];
      if (!lastRow || !Array.isArray(lastRow.cells)) return null;
      if (lastRow.cells.length > priceColumnIndex) {
        const priceStr = lastRow.cells[priceColumnIndex];
        const price = parseFloat(priceStr);
        return !isNaN(price) && price > 0 ? price : null;
      }

      return null;
    } catch (error) {
      console.error('Fehler beim Extrahieren des Preises:', error);
      return null;
    }
  }

  // Konvertiert gecachte Daten in das Chart-Format (mit Bereichsbegrenzung)
  private convertCachedDataToChart(cachedData: any, range?: string): any {
    try {
      if (!cachedData || !Array.isArray(cachedData.rows) || cachedData.rows.length < 2) {
        return { chart: { result: [] } };
      }

      // Erste Zeile enthält Spaltenüberschriften
      const headers = Array.isArray(cachedData.rows[0]?.cells) ? (cachedData.rows[0].cells as string[]) : [];
      if (headers.length === 0) {
        return { chart: { result: [] } };
      }

      // Finde relevante Spalten
      const timeColumnIndex = this.findTimeColumnIndex(headers);
      const priceColumnIndex = this.findPriceColumnIndex(headers);
      const volumeColumnIndex = this.findVolumeColumnIndex(headers);

      if (priceColumnIndex === -1) {
        return { chart: { result: [] } };
      }

      // Filtere Daten nach Zeitraum (basierend auf der Dokumentation)
      const filteredRows = this.filterDataByTimeframe(cachedData.rows, range);
      if (filteredRows.length < 2) {
        return { chart: { result: [] } };
      }

      // Konvertiere die gefilterten Daten
      const timestamps: number[] = [];
      const prices: number[] = [];
      const volumes: number[] = [];

      // Verarbeite alle Zeilen und sammle gültige Daten
      for (let i = 1; i < filteredRows.length; i++) {
        const row = filteredRows[i];
        if (!row || !Array.isArray(row.cells)) continue;

        let hasValidData = false;
        let timestamp: number | null = null;
        let price: number | null = null;
        let volume: number | null = null;

        // Preis
        if (row.cells.length > priceColumnIndex) {
          const priceStr = row.cells[priceColumnIndex];
          price = parseFloat(priceStr);
          if (!isNaN(price) && price > 0) {
            hasValidData = true;
          }
        }

        // Zeitstempel
        if (timeColumnIndex !== -1 && row.cells[timeColumnIndex]) {
          const timeStr = row.cells[timeColumnIndex];
          timestamp = this.parseTimeString(timeStr);
        }

        // Volumen
        if (volumeColumnIndex !== -1 && row.cells[volumeColumnIndex]) {
          const volumeStr = row.cells[volumeColumnIndex];
          volume = parseFloat(volumeStr);
          if (isNaN(volume)) volume = null;
        }

        // Nur hinzufügen, wenn gültige Daten vorhanden sind
        if (hasValidData && timestamp) {
          timestamps.push(timestamp);
          prices.push(price!);
          volumes.push(volume || 0);
        }
      }

      // Mindestens 10 Datenpunkte für eine sinnvolle Darstellung
      if (prices.length < 10) {
        console.warn(`Zu wenige Datenpunkte gefunden: ${prices.length}. Versuche alle verfügbaren Daten zu verwenden.`);

        // Verwende alle verfügbaren Daten ohne Zeitfilterung
        const allRows = cachedData.rows.slice(1);
        for (let i = 0; i < allRows.length; i++) {
          const row = allRows[i];
          if (!row || !Array.isArray(row.cells)) continue;

          if (row.cells.length > priceColumnIndex) {
            const priceStr = row.cells[priceColumnIndex];
            const price = parseFloat(priceStr);
            if (!isNaN(price) && price > 0) {
              prices.push(price);

              // Zeitstempel
              if (timeColumnIndex !== -1 && row.cells[timeColumnIndex]) {
                const timeStr = row.cells[timeColumnIndex];
                const timestamp = this.parseTimeString(timeStr);
                if (timestamp) timestamps.push(timestamp);
              }

              // Volumen
              if (volumeColumnIndex !== -1 && row.cells[volumeColumnIndex]) {
                const volumeStr = row.cells[volumeColumnIndex];
                const volume = parseFloat(volumeStr);
                volumes.push(isNaN(volume) ? 0 : volume);
              }
            }
          }
        }
      }

      // Erstelle das Chart-Format
      return {
        chart: {
          result: [{
            timestamp: timestamps.length > 0 ? timestamps : undefined,
            indicators: {
              quote: [{
                close: prices,
                volume: volumes.length > 0 ? volumes : undefined
              }]
            }
          }]
        }
      };
    } catch (error) {
      console.error('Fehler beim Konvertieren der gecachten Daten:', error);
      return { chart: { result: [] } };
    }
  }

  // Filtert Daten nach Zeitraum (basierend auf der Dokumentation)
  private filterDataByTimeframe(rows: any[], timeframe?: string): any[] {
    if (!rows || rows.length < 2) return [];

    const header = rows[0];
    const dataRows = rows.slice(1); // Erste Zeile ist Header

    if (dataRows.length === 0) return [header];

    // Finde die Zeitstempel-Spalte
    const timeColumnIndex = this.findTimeColumnIndex(header.cells);
    if (timeColumnIndex === -1) {
      // Keine Zeitstempel-Spalte gefunden, gib alle Daten zurück
      return rows;
    }

    // Zeitstempel der letzten Zeile
    const lastRow = dataRows[dataRows.length - 1];
    if (!lastRow || !Array.isArray(lastRow.cells) || lastRow.cells.length <= timeColumnIndex) {
      return rows;
    }

    const lastTimestamp = this.parseTimeString(lastRow.cells[timeColumnIndex]);
    if (!lastTimestamp) {
      return rows;
    }

    const lastTime = new Date(lastTimestamp * 1000);
    const now = new Date();

    let startTime: Date;

    switch (timeframe) {
      case '1d':
        // Für 1 Tag: Behalte alle Daten der letzten 24 Stunden + zusätzliche Daten für bessere Darstellung
        startTime = new Date(now.getTime() - 36 * 60 * 60 * 1000); // 36 Stunden zurück
        break;
      case '1w':
        // Für 1 Woche: Behalte alle Daten der letzten 8 Tage
        startTime = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
        break;
      case '1m':
        // Für 1 Monat: Behalte alle Daten der letzten 35 Tage
        startTime = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        // Für 1 Jahr: Behalte alle Daten der letzten 370 Tage
        startTime = new Date(now.getTime() - 370 * 24 * 60 * 60 * 1000);
        break;
      case '5y':
        // Für 5 Jahre: Behalte alle Daten der letzten 5.5 Jahre
        startTime = new Date(now.getTime() - 5.5 * 365 * 24 * 60 * 60 * 1000);
        break;
      case 'max':
        startTime = new Date(0); // Alle verfügbaren Daten
        break;
      default:
        startTime = new Date(now.getTime() - 36 * 60 * 60 * 1000); // Standard: 36 Stunden
    }

    // Filtere Daten nach Zeitraum, aber behalte mindestens 50 Datenpunkte
    const filteredRows = dataRows.filter(row => {
      if (!row || !Array.isArray(row.cells) || row.cells.length <= timeColumnIndex) {
        return false;
      }

      const rowTimeStr = row.cells[timeColumnIndex];
      const rowTimestamp = this.parseTimeString(rowTimeStr);
      if (!rowTimestamp) return false;

      const rowTime = new Date(rowTimestamp * 1000);
      return rowTime >= startTime;
    });

    // Wenn zu wenige Daten gefiltert wurden, nimm mehr Daten
    if (filteredRows.length < 50 && dataRows.length > 50) {
      // Nimm die letzten 100 Datenpunkte oder alle verfügbaren
      const minDataPoints = Math.min(100, dataRows.length);
      const additionalRows = dataRows.slice(-minDataPoints);
      return [header, ...additionalRows];
    }

    // Füge Header hinzu
    return [header, ...filteredRows];
  }

  private pickSliceCount(range?: string): number {
    switch ((range || '').toLowerCase()) {
      case '1d': return 288;   // 24 Stunden * 12 (5-Minuten-Intervalle)
      case '1w': return 336;   // 7 Tage * 48 (5-Minuten-Intervalle)
      case '1m': return 1440;  // 30 Tage * 48 (5-Minuten-Intervalle)
      case '1y': return 365;   // 365 Tage (täglich)
      case '5y': return 1825;  // 5 Jahre * 365 Tage
      case 'max':
      default:
        return Infinity;
    }
  }

  // Hilfsfunktionen für Spaltenerkennung
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

  private findTimeColumnIndex(headers: string[]): number {
    const timeKeywords = ['time', 'date', 'timestamp', 'zeit', 'datum', 'data'];
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toLowerCase();
      if (timeKeywords.some(keyword => header.includes(keyword))) {
        return i;
      }
    }
    return -1;
  }

  private findVolumeColumnIndex(headers: string[]): number {
    const volumeKeywords = ['volume', 'vol', 'volumen', 'wolumen'];
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toLowerCase();
      if (volumeKeywords.some(keyword => header.includes(keyword))) {
        return i;
      }
    }
    return -1;
  }

  private parseTimeString(timeStr: string): number | null {
    try {
      // Versuche verschiedene Zeitformate zu parsen
      const date = new Date(timeStr);
      if (!isNaN(date.getTime())) {
        return Math.floor(date.getTime() / 1000);
      }

      // Fallback: Aktueller Zeitstempel
      return Math.floor(Date.now() / 1000);
    } catch (error) {
      return Math.floor(Date.now() / 1000);
    }
  }

  /**
   * Speichert einen neuen Eintrag in der Asset-Historie
   * @param userId Die ID des Benutzers
   * @param totalValue Gesamtwert des Portfolios (Cash + Assets)
   * @param cashBalance Barguthaben
   * @param assetsValue Wert aller Assets
   */
  saveAssetHistoryRecord(userId: string, totalValue: number, cashBalance: number, assetsValue: number): Observable<string> {
    return this.firestoreService.saveAssetHistoryRecord(userId, totalValue, cashBalance, assetsValue);
  }

  /**
   * Ruft die Asset-Historie für einen Benutzer ab
   * @param userId Die ID des Benutzers
   * @param days Anzahl der Tage in der Vergangenheit (Standard: 30)
   */
  getAssetHistory(userId: string, days: number = 30): Observable<any[]> {
    return this.firestoreService.getAssetHistory(userId, days);
  }
}
