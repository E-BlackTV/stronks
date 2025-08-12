import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { TradingService } from '../../services/trading.service';
import { TradePopupComponent } from '../../components/trade-popup/trade-popup.component';
import { Chart, registerables } from 'chart.js';
import { FirebaseAdminService } from '../../services/firebase-admin.service';
import { MarketDataService } from '../../services/market-data.service';

@Component({
  selector: 'app-asset-detail',
  templateUrl: './asset-detail.page.html',
  styleUrls: ['./asset-detail.page.scss']
})
export class AssetDetailPage implements OnInit, OnDestroy {
  @ViewChild('detailChart', { static: false }) detailChart!: ElementRef<HTMLCanvasElement>;
  symbol = '';
  price: number | null = null;
  chartData: any = null;
  chart: Chart | null = null;
  lastUpdated: Date | null = null;
  range: '1d' | '1w' | '1m' | '3m' | '6m' | '1y' | '5y' | 'max' = '1d';
  high: number | null = null;
  low: number | null = null;
  marketCapUsd: number | null = null;
  description: string | null = null;
  userOwnsAsset: boolean = false;
  availableQuantity: number = 0;

  // Auto-Update Intervall
  private updateInterval: any = null;

  constructor(
    private route: ActivatedRoute,
    private modalController: ModalController,
    private tradingService: TradingService,
    private auth: FirebaseAdminService,
    private marketData: MarketDataService,
  ) {
    Chart.register(...registerables);
  }

  ngOnInit() {
    this.symbol = this.route.snapshot.paramMap.get('symbol') || '';

    const user = this.auth.getCurrentUser();
    if (user?.id) {
      this.tradingService.getBalance(user.id).subscribe((res) => {
        // nur zwischenspeichern; beim OpenBuy übergeben
        this._userBalance = res?.balance ?? 0;
      });

      // Check if user owns this asset
      this.checkUserOwnsAsset(user.id);
    }

    this.loadMeta();
    this.loadChart();

    // Starte automatische Updates alle 60 Sekunden
    this.startAutoUpdate();
  }

  // Check if user owns this asset and update userOwnsAsset property
  private checkUserOwnsAsset(userId: string) {
    this.tradingService.getPortfolio(userId).subscribe({
      next: (response) => {
        if (response.success) {
          // Find the asset in the portfolio
          const asset = response.assets.find((a: any) => a.symbol === this.symbol);
          this.availableQuantity = asset ? asset.quantity : 0;
          this.userOwnsAsset = this.availableQuantity > 0;
          console.log(`User owns ${this.availableQuantity} of ${this.symbol}: ${this.userOwnsAsset}`);
        } else {
          console.error('Failed to get portfolio:', response);
          this.userOwnsAsset = false;
          this.availableQuantity = 0;
        }
      },
      error: (error) => {
        console.error('Error getting portfolio:', error);
        this.userOwnsAsset = false;
        this.availableQuantity = 0;
      }
    });
  }

  private _userBalance = 0;

  ngOnDestroy() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    // Stoppe Auto-Update
    this.stopAutoUpdate();
  }

  // Starte automatische Updates alle 60 Sekunden
  private startAutoUpdate() {
    this.updateInterval = setInterval(() => {
      console.log(`Auto-Update für ${this.symbol}: Lade neue Daten...`);
      this.loadChart();

      // Also refresh user ownership status
      const user = this.auth.getCurrentUser();
      if (user?.id) {
        this.checkUserOwnsAsset(user.id);
      }
    }, 60000); // 60 Sekunden
  }

  // Stoppe automatische Updates
  private stopAutoUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private renderChart() {
    const ds = this.chartData?.chart?.result?.[0];
    const prices: number[] = ds?.indicators?.quote?.[0]?.close || [];
    const timestamps: number[] = ds?.timestamp || [];
    if (!prices.length || !timestamps.length) {
      console.warn('Keine Preisdaten oder Zeitstempel für Chart gefunden');
      return;
    }

    console.log(`Rendere Chart mit ${prices.length} Preispunkten und ${timestamps.length} Zeitstempeln`);
    console.log(`Zeitraum: ${this.range}, Erste Zeit: ${new Date(timestamps[0] * 1000).toISOString()}, Letzte Zeit: ${new Date(timestamps[timestamps.length - 1] * 1000).toISOString()}`);

    const labels = timestamps.map((ts: number) => {
      const d = new Date(ts * 1000);
      if (this.range === '1d') {
        return d.toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      }
      if (this.range === '1w' || this.range === '1m') {
        return d.toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit'
        });
      }
      if (this.range === '1y' || this.range === '5y') {
        return d.toLocaleDateString('de-DE', {
          month: '2-digit',
          year: '2-digit'
        });
      }
      return d.toLocaleDateString('de-DE');
    });

    if (!this.detailChart?.nativeElement) return;
    if (this.chart) { this.chart.destroy(); this.chart = null; }

    const color = getComputedStyle(document.documentElement).getPropertyValue('--accent-turquoise').trim() || '#10b981';
    this.chart = new Chart(this.detailChart.nativeElement, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: `${this.symbol} Preis (USD)`,
          data: prices,
          borderColor: color,
          backgroundColor: color + '33',
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
          tension: 0.35,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: 'rgba(255,255,255,0.06)' } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            displayColors: false,
            padding: 10,
            callbacks: {
              title: (items) => items[0]?.label || '',
              label: (ctx) => `Preis: $${(ctx.parsed.y as number).toFixed(2)}`,
            },
          },
        },
      }
    });

    console.log('Chart erfolgreich gerendert');
  }

  private pickInterval(range: string): string {
    switch (range) {
      case '1d': return '5m';      // 5-Minuten-Intervalle für 1 Tag
      case '1w': return '1d';      // Tägliche Daten für 1 Woche
      case '1m': return '1d';      // Tägliche Daten für 1 Monat
      case '3m': return '1d';      // Tägliche Daten für 3 Monate
      case '6m': return '1d';      // Tägliche Daten für 6 Monate
      case '1y': return '1d';      // Tägliche Daten für 1 Jahr
      case '5y': return '1wk';     // Wöchentliche Daten für 5 Jahre
      case 'max': return '1mo';    // Monatliche Daten für Max
      default: return '1d';
    }
  }

  changeRange(event: any) {
    try {
      console.log('changeRange Event erhalten:', event);

      let newRange: string;

      // Ionic CustomEvent mit detail.value behandeln
      if (event && event.detail && event.detail.value) {
        newRange = event.detail.value;
        console.log('Zeitraum aus event.detail.value:', newRange);
      } else if (event && typeof event === 'string') {
        newRange = event;
        console.log('Zeitraum aus String-Event:', newRange);
      } else if (event && event.target && event.target.value) {
        newRange = event.target.value;
        console.log('Zeitraum aus event.target.value:', newRange);
      } else {
        console.error('Unbekanntes Event-Format:', event);
        return;
      }

      // Validiere den neuen Zeitraum
      const validRanges: ('1d' | '1w' | '1m' | '3m' | '6m' | '1y' | '5y' | 'max')[] = ['1d', '1w', '1m', '3m', '6m', '1y', '5y', 'max'];
      if (!validRanges.includes(newRange as any)) {
        console.error('Ungültiger Zeitraum:', newRange);
        return;
      }

      if (this.range === newRange) {
        console.log('Zeitraum hat sich nicht geändert, überspringe Update');
        return;
      }

      console.log(`Wechsle Zeitraum von ${this.range} zu ${newRange}`);
      this.range = newRange as '1d' | '1w' | '1m' | '3m' | '6m' | '1y' | '5y' | 'max';

      // Lade neue Chart-Daten für den neuen Zeitraum
      console.log('Lade Chart-Daten für neuen Zeitraum:', newRange);
      this.loadChart();

    } catch (error) {
      console.error('Fehler in changeRange:', error, 'Event:', event);
    }
  }

  private loadChart() {
    const interval = this.pickInterval(this.range);
    console.log(`Lade Chart für ${this.symbol}, Zeitraum: ${this.range}, Intervall: ${interval}`);

    this.tradingService.getChartData(this.symbol, this.range, interval).subscribe({
      next: (data: any) => {
        console.log(`Chart-Daten erhalten für ${this.symbol}:`, data);
        this.chartData = data;
        const ds = data?.chart?.result?.[0];
        const ts: number[] = ds?.timestamp || [];
        const prices: number[] = ds?.indicators?.quote?.[0]?.close || [];

        console.log(`Verarbeite ${prices.length} Preispunkte für ${this.symbol}`);

        // Korrigiere Zeitstempel-Behandlung
        if (ts.length > 0) {
          // Verwende den neuesten Zeitstempel für lastUpdated
          const latestTimestamp = ts[ts.length - 1];
          this.lastUpdated = new Date(latestTimestamp * 1000);

          // Debug: Zeige Zeitstempel-Informationen
          console.log(`Neuester Zeitstempel: ${latestTimestamp} -> ${this.lastUpdated.toISOString()}`);
          console.log(`Aktuelle lokale Zeit: ${new Date().toISOString()}`);
        } else {
          this.lastUpdated = null;
        }

        if (prices.length) {
          this.high = Math.max(...prices);
          this.low = Math.min(...prices);
          this.price = prices[prices.length - 1];
          console.log(`${this.symbol} - Aktueller Preis: $${this.price}, Hoch: $${this.high}, Tief: $${this.low}`);
        } else {
          console.warn(`Keine Preisdaten für ${this.symbol} gefunden`);
        }
        this.renderChart();
      },
      error: (error) => {
        console.error(`Fehler beim Laden der Chart-Daten für ${this.symbol}:`, error);
        // Fallback: Zeige leeren Chart
        this.chartData = { chart: { result: [] } };
        this.renderChart();
      }
    });
  }

  private loadMeta() {
    if (/-USD$/.test(this.symbol)) {
      this.marketData.fetchCoinMeta(this.symbol).subscribe((meta) => {
        this.marketCapUsd = meta?.marketCapUsd ?? null;
        this.description = meta?.description ?? null;
      });
    }
  }

  async openBuy() {
    const modal = await this.modalController.create({
      component: TradePopupComponent,
      componentProps: {
        action: 'buy',
        assetSymbol: this.symbol,
        currentPrice: this.price || 0,
        userBalance: this._userBalance,
        availableQuantity: 0,
      }
    });
    await modal.present();

    const result = await modal.onDidDismiss();
    if (result.data?.refresh) {
      this.loadChart(); // Refresh data after trade
    }
  }

  async openSell() {
    // Get user's available quantity of this asset
    const user = this.auth.getCurrentUser();
    if (!user?.id) {
      console.error('User not logged in');
      return;
    }

    // Use the availableQuantity property that we're already tracking
    if (this.availableQuantity <= 0) {
      // Show alert if user doesn't own any of this asset
      const alert = await this.modalController.create({
        component: 'ion-alert',
        componentProps: {
          header: 'Keine Bestände',
          message: `Du besitzt keine ${this.symbol} zum Verkaufen.`,
          buttons: ['OK']
        }
      });
      await alert.present();
      return;
    }

    // Open sell modal
    const modal = await this.modalController.create({
      component: TradePopupComponent,
      componentProps: {
        action: 'sell',
        assetSymbol: this.symbol,
        currentPrice: this.price || 0,
        userBalance: this._userBalance,
        availableQuantity: this.availableQuantity,
      }
    });
    await modal.present();

    const result = await modal.onDidDismiss();
    if (result.data?.refresh) {
      this.loadChart(); // Refresh data after trade

      // Also refresh user ownership status after trade
      if (user?.id) {
        this.checkUserOwnsAsset(user.id);
      }
    }
  }
}
