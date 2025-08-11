import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, catchError, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface NormalizedChartResponse {
  source: 'coingecko' | 'alphavantage' | 'binance' | 'yahoo' | 'stooq' | 'fmp';
  data: any; // Yahoo-Chart-Format
}

export interface MarketAsset {
  type: 'crypto' | 'stock';
  symbol: string;
  name: string;
  price?: number;
}

@Injectable({ providedIn: 'root' })
export class MarketDataService {
  private alphaVantageApiKey = (environment as any).alphaVantageApiKey as string | undefined;
  private fmpApiKey = (environment as any).fmpApiKey as string | undefined;

  constructor(private http: HttpClient) {}

  // ======= Listen holen =======
  // CoinGecko Top-Märkte (preis + symbol + name)
  fetchTopCryptoMarkets(vsCurrency: string = 'usd', perPage: number = 100): Observable<MarketAsset[]> {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${encodeURIComponent(vsCurrency)}&order=market_cap_desc&per_page=${perPage}&page=1&sparkline=false&price_change_percentage=24h`;
    return this.http.get<any[]>(url).pipe(
      map(rows => (rows || []).map(r => ({ type: 'crypto' as const, symbol: (r.symbol || '').toUpperCase() + '-USD', name: r.name, price: r.current_price }) )),
      catchError(() => of([]))
    );
  }

  // Aktienliste (Fallback auf eine kompakte statische Liste, falls kein Key vorhanden)
  fetchTopStocks(perPage: number = 50): Observable<MarketAsset[]> {
    const staticList: MarketAsset[] = [
      { type: 'stock', symbol: 'AAPL', name: 'Apple Inc.' },
      { type: 'stock', symbol: 'MSFT', name: 'Microsoft Corporation' },
      { type: 'stock', symbol: 'GOOGL', name: 'Alphabet Inc.' },
      { type: 'stock', symbol: 'AMZN', name: 'Amazon.com, Inc.' },
      { type: 'stock', symbol: 'TSLA', name: 'Tesla, Inc.' },
      { type: 'stock', symbol: 'META', name: 'Meta Platforms, Inc.' },
      { type: 'stock', symbol: 'NVDA', name: 'NVIDIA Corporation' },
      { type: 'stock', symbol: 'BRK.B', name: 'Berkshire Hathaway Inc.' },
      { type: 'stock', symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
      { type: 'stock', symbol: 'V', name: 'Visa Inc.' },
      { type: 'stock', symbol: 'JNJ', name: 'Johnson & Johnson' },
      { type: 'stock', symbol: 'WMT', name: 'Walmart Inc.' },
      { type: 'stock', symbol: 'PG', name: 'Procter & Gamble Co.' },
      { type: 'stock', symbol: 'XOM', name: 'Exxon Mobil Corporation' },
      { type: 'stock', symbol: 'MA', name: 'Mastercard Incorporated' },
      { type: 'stock', symbol: 'UNH', name: 'UnitedHealth Group Incorporated' },
      { type: 'stock', symbol: 'HD', name: 'Home Depot, Inc.' },
      { type: 'stock', symbol: 'BAC', name: 'Bank of America Corporation' },
      { type: 'stock', symbol: 'PFE', name: 'Pfizer Inc.' },
      { type: 'stock', symbol: 'DIS', name: 'The Walt Disney Company' },
      { type: 'stock', symbol: 'KO', name: 'Coca-Cola Company' },
      { type: 'stock', symbol: 'PEP', name: 'PepsiCo, Inc.' },
      { type: 'stock', symbol: 'NFLX', name: 'Netflix, Inc.' },
      { type: 'stock', symbol: 'ADBE', name: 'Adobe Inc.' },
      { type: 'stock', symbol: 'CRM', name: 'Salesforce, Inc.' },
      { type: 'stock', symbol: 'CSCO', name: 'Cisco Systems, Inc.' },
      { type: 'stock', symbol: 'INTC', name: 'Intel Corporation' },
      { type: 'stock', symbol: 'AMD', name: 'Advanced Micro Devices, Inc.' },
      { type: 'stock', symbol: 'NKE', name: 'NIKE, Inc.' },
      { type: 'stock', symbol: 'SAP', name: 'SAP SE' },
      { type: 'stock', symbol: 'ORCL', name: 'Oracle Corporation' },
      { type: 'stock', symbol: 'TM', name: 'Toyota Motor Corporation' },
      { type: 'stock', symbol: 'BABA', name: 'Alibaba Group Holding Limited' },
      { type: 'stock', symbol: 'TCEHY', name: 'Tencent Holdings Ltd.' },
      { type: 'stock', symbol: 'SONY', name: 'Sony Group Corporation' },
      { type: 'stock', symbol: 'UBER', name: 'Uber Technologies, Inc.' },
      { type: 'stock', symbol: 'LYFT', name: 'Lyft, Inc.' },
      { type: 'stock', symbol: 'SHOP', name: 'Shopify Inc.' },
      { type: 'stock', symbol: 'SQ', name: 'Block, Inc.' },
      { type: 'stock', symbol: 'PYPL', name: 'PayPal Holdings, Inc.' },
      { type: 'stock', symbol: 'MRNA', name: 'Moderna, Inc.' },
      { type: 'stock', symbol: 'ABNB', name: 'Airbnb, Inc.' },
      { type: 'stock', symbol: 'PLTR', name: 'Palantir Technologies Inc.' }
    ];
    if (!this.alphaVantageApiKey) {
      return of(staticList.slice(0, perPage));
    }
    return of(staticList.slice(0, perPage));
  }

  // Preisauflösung für ein Asset (Symbol)
  resolveLatestPrice(symbol: string): Observable<number | null> {
    // Für Krypto: CoinGecko-Chart (1d) holen, letzten Close nehmen, und cachen
    const isCrypto = symbol.includes('-USD') || /^[A-Z]{2,10}-USD$/.test(symbol);
    if (isCrypto) {
      return this.fetchCryptoChart(symbol, '1d', '5m').pipe(
        switchMap(res => {
          const prices = res?.data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
          const last = prices.length ? prices[prices.length - 1] : null;
          if (res?.data && last !== null) {
            // Cache chart
            // Hinweis: Firestore-Service ist hier nicht injiziert; Caching übernimmt TradingService.getChartData
          }
          return of(last);
        }),
        catchError(() => of(null))
      );
    }
    // Für Aktien: Zuerst Alpha Vantage, ansonsten Yahoo als Fallback
    if (!this.alphaVantageApiKey) {
      return this.fetchYahooChart(symbol, '1d', '5m').pipe(
        map(res => {
          const prices = res?.data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
          return prices.length ? prices[prices.length - 1] : null;
        }),
        catchError(() => of(null))
      );
    }
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(symbol)}&apikey=${this.alphaVantageApiKey}`;
    return this.http.get<any>(url).pipe(
      map(res => {
        const key = Object.keys(res).find(k => k.startsWith('Time Series'));
        if (!key) return null;
        const series = res[key];
        const last = Object.values(series)[0] as any;
        return last ? parseFloat((last as any)['4. close']) : null;
      }),
      catchError(() =>
        // Fallback auf Yahoo, falls Alpha Vantage fehl schlägt (Rate-Limit etc.)
        this.fetchYahooChart(symbol, '1d', '5m').pipe(
          map(res => {
            const prices = res?.data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
            return prices.length ? prices[prices.length - 1] : null;
          }),
          catchError(() => of(null))
        )
      )
    );
  }

  // ======= Bestehende Chart-APIs (unverändert) =======
  private mapSymbolToCoinId(symbol: string): string | null {
    const sym = symbol.replace('-USD', '').toUpperCase();
    const map: Record<string, string> = {
      BTC: 'bitcoin',
      ETH: 'ethereum',
      WETH: 'weth',
      SOL: 'solana',
      ADA: 'cardano',
      XRP: 'ripple',
      DOGE: 'dogecoin',
      LTC: 'litecoin',
      BNB: 'binancecoin',
      AVAX: 'avalanche-2',
      MATIC: 'matic-network',
      DOT: 'polkadot',
      LINK: 'chainlink',
      TRX: 'tron',
      ATOM: 'cosmos',
      XLM: 'stellar',
      UNI: 'uniswap',
      APT: 'aptos',
      ARB: 'arbitrum',
      OP: 'optimism',
    };
    return map[sym] ?? null;
  }
  private mapSymbolToBinancePair(symbol: string): string | null {
    const sym = symbol.toUpperCase();
    if (sym.endsWith('-USD')) { const base = sym.replace('-USD', ''); return `${base}USDT`; }
    if (/^[A-Z]{3,6}USDT$/.test(sym)) return sym;
    return null;
  }
  private mapIntervalToCoinGecko(interval: string): 'daily' | undefined { const i = interval.toLowerCase(); return ['1d', '1day', 'daily'].includes(i) ? 'daily' : undefined; }
  private mapIntervalToAlpha(interval: string): string | null { const i = interval.toLowerCase(); const map: Record<string, string> = { '1m': '1min', '5m': '5min', '15m': '15min', '30m': '30min', '60m': '60min', '1h': '60min', }; return map[i] ?? null; }
  private mapIntervalToBinance(interval: string): string { const i = interval.toLowerCase(); const map: Record<string, string> = { '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1h', '60m': '1h', '1d': '1d', '1wk': '1w', '1mo': '1M', }; return map[i] ?? '1h'; }

  fetchCryptoChart(symbol: string, range: string, interval: string): Observable<NormalizedChartResponse | null> {
    const coinId = this.mapSymbolToCoinId(symbol);
    const cgInterval = this.mapIntervalToCoinGecko(interval);
    const days = this.mapRangeToCoinGeckoDays(range);
    if (!coinId) return of(null);
    return this.http.get<any>(this.buildCoinGeckoUrl(coinId, days, cgInterval)).pipe(
      map((res) => {
        const timestamps: number[] = (res.prices || []).map((p: any[]) => Math.floor((p[0] as number) / 1000));
        const prices: number[] = (res.prices || []).map((p: any[]) => p[1] as number);
        const volumes: number[] = (res.total_volumes || []).map((v: any[]) => v[1] as number);
        if (!prices.length) return null;
        const data = this.toYahooChartFormat(timestamps, prices, volumes);
        return { source: 'coingecko' as const, data };
      }),
      catchError(() => of(null))
    );
  }
  private buildCoinGeckoUrl(coinId: string, days: number | 'max', cgInterval?: 'daily'): string {
    const base = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
    return cgInterval ? `${base}&interval=${cgInterval}` : base;
  }
  private fetchCryptoChartBinance(symbol: string, _range: string, interval: string): Observable<NormalizedChartResponse | null> {
    // Binance deaktiviert wegen CORS im Frontend. Rückgabe: null
    return of(null);
  }

  fetchStockChart(symbol: string, _range: string, interval: string): Observable<NormalizedChartResponse | null> {
    if (!this.alphaVantageApiKey) return of(null);
    const avInterval = this.mapIntervalToAlpha(interval);
    const isIntraday = !!avInterval;
    if (isIntraday) {
      const functionName = 'TIME_SERIES_INTRADAY';
      const url = `https://www.alphavantage.co/query?function=${functionName}&symbol=${encodeURIComponent(symbol)}&interval=${avInterval}&outputsize=compact&apikey=${this.alphaVantageApiKey}`;
      return this.http.get<any>(url).pipe(
        map((res) => this.normalizeAlphaVantageIntraday(res)),
        catchError(() => of(null))
      );
    } else {
      const functionName = 'TIME_SERIES_DAILY_ADJUSTED';
      const url = `https://www.alphavantage.co/query?function=${functionName}&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${this.alphaVantageApiKey}`;
      return this.http.get<any>(url).pipe(
        map((res) => this.normalizeAlphaVantageDaily(res)),
        catchError(() => of(null))
      );
    }
  }

  // Yahoo-Fallback (für Crypto und Aktien)
  fetchYahooChart(symbol: string, range: string, interval: string): Observable<NormalizedChartResponse | null> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
    return this.http.get<any>(url).pipe(
      map((res) => {
        if (res?.chart?.result?.[0]) {
          return { source: 'yahoo' as const, data: res };
        }
        return null;
      }),
      catchError(() => of(null))
    );
  }

  // Stooq-Fallback (EOD, kein Key). Degradiert bei Intraday-Anfrage auf Daily.
  fetchStockChartStooq(symbol: string, range: string, interval: string): Observable<NormalizedChartResponse | null> {
    // Stooq bietet CSV: https://stooq.com/q/d/l/?s=aapl&i=d
    // Wir nutzen Daily-Daten unabhängig vom angefragten Intervall (Fallback)
    const stooqSymbol = this.normalizeSymbolForStooq(symbol);
    if (!stooqSymbol) return of(null);
    const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&i=d`;
    return this.http.get(url, { responseType: 'text' as 'json' }).pipe(
      map((csvText: any) => {
        const lines = String(csvText).trim().split(/\r?\n/);
        if (lines.length <= 1) return null;
        const header = lines[0].toLowerCase();
        if (!header.includes('date') || !header.includes('close')) return null;
        const timestamps: number[] = [];
        const prices: number[] = [];
        const volumes: number[] = [];
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(',');
          if (row.length < 5) continue;
          const dateStr = row[0];
          const closeStr = row[4];
          const volumeStr = row[5] ?? '0';
          const t = Math.floor(new Date(dateStr).getTime() / 1000);
          const c = parseFloat(closeStr);
          const v = parseFloat(volumeStr) || 0;
          if (!isFinite(t) || !isFinite(c)) continue;
          timestamps.push(t);
          prices.push(c);
          volumes.push(v);
        }
        if (!prices.length) return null;
        const data = this.toYahooChartFormat(timestamps, prices, volumes);
        return { source: 'stooq' as const, data };
      }),
      catchError(() => of(null))
    );
  }

  private normalizeSymbolForStooq(symbol: string): string | null {
    // Stooq verwendet lower-case Symbole, Punkte oft zu '-' oder ohne Suffixe
    const s = symbol.trim().toLowerCase();
    // Crypto ignorieren
    if (/-usd$/.test(s)) return null;
    // BRK.B -> brk-b, RDS.A -> rds-a etc.
    return s.replace(/\./g, '-');
  }

  // Financial Modeling Prep (FMP) optionaler Fallback (einfacher API-Key, demo funktioniert eingeschränkt)
  fetchStockChartFmp(symbol: string, range: string, interval: string): Observable<NormalizedChartResponse | null> {
    const apiKey = this.fmpApiKey || 'demo';
    // Intraday: 1, 5, 15, 30 min
    const intradayMap: Record<string, string> = { '1m': '1min', '5m': '5min', '15m': '15min', '30m': '30min', '60m': '1hour', '1h': '1hour' };
    const fmpInterval = intradayMap[interval.toLowerCase()];
    if (fmpInterval) {
      const url = `https://financialmodelingprep.com/api/v3/historical-chart/${fmpInterval}/${encodeURIComponent(symbol)}?apikey=${apiKey}`;
      return this.http.get<any[]>(url).pipe(
        map((rows) => {
          if (!Array.isArray(rows) || rows.length === 0) return null;
          // FMP gibt jüngste zuerst zurück
          const sorted = rows.slice().reverse();
          const timestamps = sorted.map(r => Math.floor(new Date(r.date).getTime() / 1000));
          const prices = sorted.map(r => parseFloat(r.close));
          const volumes = sorted.map(r => parseFloat(r.volume ?? 0));
          if (!prices.length) return null;
          const data = this.toYahooChartFormat(timestamps, prices, volumes);
          return { source: 'fmp' as const, data };
        }),
        catchError(() => of(null))
      );
    }
    // Daily
    const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${encodeURIComponent(symbol)}?serietype=line&apikey=${apiKey}`;
    return this.http.get<any>(url).pipe(
      map((res) => {
        const rows = res?.historical as any[];
        if (!Array.isArray(rows) || rows.length === 0) return null;
        const sorted = rows.slice().reverse();
        const timestamps = sorted.map(r => Math.floor(new Date(r.date).getTime() / 1000));
        const prices = sorted.map(r => parseFloat(r.close));
        const volumes = sorted.map(_r => 0);
        if (!prices.length) return null;
        const data = this.toYahooChartFormat(timestamps, prices, volumes);
        return { source: 'fmp' as const, data };
      }),
      catchError(() => of(null))
    );
  }

  private normalizeAlphaVantageIntraday(res: any): NormalizedChartResponse | null {
    const key = Object.keys(res).find((k) => k.startsWith('Time Series'));
    if (!key) return null;
    const series = res[key];
    const entries = Object.entries(series) as [string, any][];
    entries.sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
    const timestamps = entries.map(([ts]) => Math.floor(new Date(ts).getTime() / 1000));
    const prices = entries.map(([, v]) => parseFloat(v['4. close']));
    const volumes = entries.map(([, v]) => parseFloat(v['5. volume']));
    const data = this.toYahooChartFormat(timestamps, prices, volumes);
    return { source: 'alphavantage', data };
  }
  private normalizeAlphaVantageDaily(res: any): NormalizedChartResponse | null {
    const key = Object.keys(res).find((k) => k.startsWith('Time Series'));
    if (!key) return null;
    const series = res[key];
    const entries = Object.entries(series) as [string, any][];
    entries.sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
    const timestamps = entries.map(([ts]) => Math.floor(new Date(ts).getTime() / 1000));
    const prices = entries.map(([, v]) => parseFloat(v['4. close']));
    const volumes = entries.map(([, v]) => parseFloat(v['6. volume'] ?? v['5. volume']));
    const data = this.toYahooChartFormat(timestamps, prices, volumes);
    return { source: 'alphavantage', data };
  }

  private toYahooChartFormat(timestamps: number[], prices: number[], volumes: number[]) {
    return { chart: { result: [ { timestamp: timestamps, indicators: { quote: [ { close: prices, volume: volumes } ] } } ] } };
  }

  private mapRangeToCoinGeckoDays(range: string): number | 'max' {
    switch (range) {
      case '1d':
      case 'DAY': return 1;
      case '5d':
      case 'WEEK': return 7;
      case '1m':
      case 'MONTH': return 30;
      case '3m':
      case 'THREE_MONTHS': return 90;
      case '6m':
      case 'SIX_MONTHS': return 180;
      case '1y':
      case 'YEAR': return 365;
      case '5y':
      case 'FIVE_YEARS': return 1825;
      default: return 30;
    }
  }

  fetchCoinMeta(symbol: string): Observable<{ marketCapUsd: number | null; description: string | null } | null> {
    const coinId = this.mapSymbolToCoinId(symbol);
    if (!coinId) return of(null);
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
    return this.http.get<any>(url).pipe(
      map(res => {
        const marketCapUsd = res?.market_data?.market_cap?.usd ?? null;
        const desc = (res?.description?.de || res?.description?.en || '').trim();
        const description = desc ? (desc.length > 300 ? desc.slice(0, 300) + '…' : desc) : null;
        return { marketCapUsd, description };
      }),
      catchError(() => of(null))
    );
  }
} 