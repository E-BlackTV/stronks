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
        this.renderChartFromAssets(this.balance, this.assets);
      }
    });
  }

  ngOnDestroy() {
    if (this.chart) { this.chart.destroy(); this.chart = null; }
  }

  private renderChartFromAssets(cash: number, assets: any[]) {
    const labels: string[] = [];
    const values: number[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24*60*60*1000);
      labels.push(d.toLocaleDateString());
      // Näherung: Gesamtwert = Cash + Summe(currentPrice*quantity) (keine Historie vorhanden → flacher Verlauf mit leichtem Rauschen)
      const current = cash + assets.reduce((s, a) => s + (a.quantity * (a.currentPrice || 0)), 0);
      const noise = (Math.sin((now.getTime()/1e7)+i) * 0.005 + 1) * current;
      values.push(Math.round(noise));
    }
    if (!this.walletChart?.nativeElement) return;
    if (this.chart) { this.chart.destroy(); this.chart = null; }
    const color = getComputedStyle(document.documentElement).getPropertyValue('--accent-turquoise').trim() || '#10b981';
    this.chart = new Chart(this.walletChart.nativeElement, {
      type: 'line',
      data: { labels, datasets: [{ data: values, borderColor: color, backgroundColor: color+'33', fill: true, pointRadius: 0, tension: 0.35 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(255,255,255,0.06)' } } } }
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