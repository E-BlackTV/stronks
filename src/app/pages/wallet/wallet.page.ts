import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { TradingService } from '../../services/trading.service';
import { FirebaseAdminService } from '../../services/firebase-admin.service';
import { Chart, registerables } from 'chart.js';
import { ModalController } from '@ionic/angular';
import { TradePopupComponent } from '../../components/trade-popup/trade-popup.component';

@Component({
  selector: 'app-wallet',
  templateUrl: './wallet.page.html',
  styleUrls: ['./wallet.page.scss']
})
export class WalletPage implements OnInit, OnDestroy {
  @ViewChild('walletChart', { static: false }) walletChart!: ElementRef<HTMLCanvasElement>;
  chart: Chart | null = null;
  balance = 0;
  assets: any[] = [];

  constructor(
    private tradingService: TradingService,
    private auth: FirebaseAdminService,
    private modalController: ModalController,
  ) {
    Chart.register(...registerables);
  }

  ngOnInit() {
    const user = this.auth.getCurrentUser();
    if (!user?.id) return;
    this.tradingService.getPortfolio(user.id).subscribe((res) => {
      if (res?.success) {
        this.balance = res.cashBalance ?? 0;
        this.assets = res.assets ?? [];

        // Berechne den Gesamtwert der Assets
        const assetsValue = this.assets.reduce((sum, asset) =>
          sum + (asset.quantity * (asset.currentPrice || 0)), 0);
        const totalValue = this.balance + assetsValue;

        // Speichere den aktuellen Vermögensstand in der Historie
        this.tradingService.saveAssetHistoryRecord(
          user.id,
          totalValue,
          this.balance,
          assetsValue
        ).subscribe(() => {
          console.log('Asset history record saved successfully');

          // Lade die historischen Daten und zeige sie im Graph an
          this.loadAssetHistoryAndRenderChart(user.id);
        });
      }
    });
  }

  /**
   * Lädt die Asset-Historie und rendert den Graph
   */
  private loadAssetHistoryAndRenderChart(userId: string) {
    // Lade die Asset-Historie der letzten 7 Tage
    this.tradingService.getAssetHistory(userId, 7).subscribe(history => {
      if (history && history.length > 0) {
        // Verwende die historischen Daten für den Graph
        this.renderChartFromHistory(history);
      } else {
        // Fallback: Wenn keine historischen Daten vorhanden sind, verwende die aktuellen Daten
        this.renderChartFromAssets(this.balance, this.assets);
      }
    });
  }

  ngOnDestroy() {
    if (this.chart) { this.chart.destroy(); this.chart = null; }
  }

  /**
   * Rendert den Chart aus historischen Daten
   */
  private renderChartFromHistory(history: any[]) {
    const labels: string[] = [];
    const values: number[] = [];

    // Sortiere die Historie nach Datum (älteste zuerst)
    history.sort((a, b) => {
      const dateA = a.timestamp?.toDate?.() || new Date();
      const dateB = b.timestamp?.toDate?.() || new Date();
      return dateA.getTime() - dateB.getTime();
    });

    // Extrahiere Daten für den Chart
    history.forEach(record => {
      const date = record.timestamp?.toDate?.() || new Date();
      labels.push(date.toLocaleDateString());
      values.push(record.totalValue);
    });

    // Erstelle den Chart
    this.createChart(labels, values);
  }

  /**
   * Fallback: Rendert den Chart aus aktuellen Assets (wenn keine Historie vorhanden)
   */
  private renderChartFromAssets(cash: number, assets: any[]) {
    const labels: string[] = [];
    const values: number[] = [];
    const now = new Date();

    // Erstelle Dummy-Daten für die letzten 7 Tage
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24*60*60*1000);
      labels.push(d.toLocaleDateString());

      // Aktueller Gesamtwert
      const current = cash + assets.reduce((s, a) => s + (a.quantity * (a.currentPrice || 0)), 0);

      // Füge leichtes Rauschen hinzu für einen natürlicheren Verlauf
      const noise = (Math.sin((now.getTime()/1e7)+i) * 0.005 + 1) * current;
      values.push(Math.round(noise));
    }

    // Erstelle den Chart
    this.createChart(labels, values);
  }

  /**
   * Erstellt den Chart mit den gegebenen Daten
   */
  private createChart(labels: string[], values: number[]) {
    if (!this.walletChart?.nativeElement) return;
    if (this.chart) { this.chart.destroy(); this.chart = null; }

    const color = getComputedStyle(document.documentElement).getPropertyValue('--accent-turquoise').trim() || '#10b981';

    this.chart = new Chart(this.walletChart.nativeElement, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values,
          borderColor: color,
          backgroundColor: color+'33',
          fill: true,
          pointRadius: 0,
          tension: 0.35
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                return new Intl.NumberFormat('de-DE', {
                  style: 'currency',
                  currency: 'EUR'
                }).format(context.parsed.y);
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: {
              callback: function(value) {
                return new Intl.NumberFormat('de-DE', {
                  style: 'currency',
                  currency: 'EUR',
                  maximumFractionDigits: 0
                }).format(value as number);
              }
            }
          }
        }
      }
    });
  }

  async openSell(asset: any) {
    const user = this.auth.getCurrentUser();
    if (!user?.id) return;
    const priceRes = await this.tradingService.getAssetPrice(asset.symbol).toPromise();
    const price = priceRes?.price || 0;
    const modal = await this.modalController.create({
      component: TradePopupComponent,
      componentProps: {
        action: 'sell',
        assetSymbol: asset.symbol,
        currentPrice: price,
        userBalance: this.balance,
        availableQuantity: asset.quantity || 0,
      }
    });
    await modal.present();
  }
}
