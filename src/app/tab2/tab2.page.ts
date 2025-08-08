import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { TradePopupComponent } from '../components/trade-popup/trade-popup.component';
import { TradingService } from '../services/trading.service';
import { Router } from '@angular/router';
import { MarketDataService, MarketAsset } from '../services/market-data.service';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss']
})
export class Tab2Page implements OnInit {
  assets: MarketAsset[] = [];
  filteredAssets: MarketAsset[] = [];
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
    private marketData: MarketDataService,
  ) {}

  ngOnInit() {
    this.loading = true;
    // Lade Crypto + Stocks parallel
    this.marketData.fetchTopCryptoMarkets('usd', 100).subscribe((cryptos) => {
      this.marketData.fetchTopStocks(50).subscribe((stocks) => {
        this.assets = [...cryptos, ...stocks];
        this.cryptoCount = cryptos.length;
        this.stockCount = stocks.length;
        this.applyFilters();
        this.prefetchPrices(this.assets);
        this.loading = false;
      });
    });
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
    // Sortierung
    filtered.sort((a, b) => {
      if (this.sortBy === 'name') {
        const A = a.name.toLowerCase();
        const B = b.name.toLowerCase();
        return this.sortDir === 'asc' ? A.localeCompare(B) : B.localeCompare(A);
      } else {
        const pa = (a.price ?? this.latestPrices[a.symbol] ?? 0);
        const pb = (b.price ?? this.latestPrices[b.symbol] ?? 0);
        return this.sortDir === 'asc' ? pa - pb : pb - pa;
      }
    });
    this.filteredAssets = filtered;
  }

  private prefetchPrices(list: MarketAsset[]) {
    list.slice(0, 50).forEach(asset => {
      // Falls Preis schon geliefert (Crypto via CoinGecko), verwenden; sonst auflösen
      if (asset.price && asset.price > 0) {
        this.latestPrices[asset.symbol] = asset.price;
        return;
      }
      this.marketData.resolveLatestPrice(asset.symbol).subscribe(price => {
        if (price) this.latestPrices[asset.symbol] = price;
      });
    });
  }

  async openAsset(asset: MarketAsset) {
    const price = this.latestPrices[asset.symbol] || 0;
    const symbolForTrade = asset.type === 'crypto' ? asset.symbol : asset.symbol; // Aktien handeln später
    const modal = await this.modalController.create({
      component: TradePopupComponent,
      componentProps: {
        action: 'buy',
        assetSymbol: symbolForTrade,
        currentPrice: price,
        userBalance: 0,
        availableQuantity: 0,
      },
    });
    await modal.present();
  }

  goToDetail(asset: MarketAsset) { this.router.navigate(['/asset', asset.symbol]); }
}
