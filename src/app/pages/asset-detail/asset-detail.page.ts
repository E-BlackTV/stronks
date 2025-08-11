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
  range: '1d' | '1w' | '1m' | '1y' | '5y' | 'max' = '1d';
  high: number | null = null;
  low: number | null = null;
  marketCapUsd: number | null = null;
  description: string | null = null;

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
    }
    this.loadMeta();
    this.loadChart();
  }

  private _userBalance = 0;

  ngOnDestroy() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  private renderChart() {
    const ds = this.chartData?.chart?.result?.[0];
    const prices: number[] = ds?.indicators?.quote?.[0]?.close || [];
    const timestamps: number[] = ds?.timestamp || [];
    if (!prices.length || !timestamps.length) return;

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
  }

  private pickInterval(range: string): string {
    switch (range) {
      case '1d': return '5m';
      case '1w': return '30m';
      case '1m': return '1d';
      case '1y': return '1d';
      case '5y': return '1wk';
      case 'max': return '1mo';
      default: return '1d';
    }
  }

  changeRange(r: any) {
    if (this.range === r) return;
    this.range = r;
    this.loadChart();
  }

  private loadChart() {
    const interval = this.pickInterval(this.range);
    this.tradingService.getChartData(this.symbol, this.range, interval).subscribe((data: any) => {
      this.chartData = data;
      const ds = data?.chart?.result?.[0];
      const ts: number[] = ds?.timestamp || [];
      const prices: number[] = ds?.indicators?.quote?.[0]?.close || [];
      this.lastUpdated = ts.length ? new Date(ts[ts.length - 1] * 1000) : null;
      if (prices.length) {
        this.high = Math.max(...prices);
        this.low = Math.min(...prices);
        this.price = prices[prices.length - 1];
      }
      this.renderChart();
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
  }
} 