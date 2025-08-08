import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, catchError, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface NormalizedChartResponse {
  source: 'coingecko' | 'alphavantage' | 'binance';
  data: any; // Yahoo-Chart-Format
}

@Injectable({ providedIn: 'root' })
export class MarketDataService {
  private alphaVantageApiKey = (environment as any).alphaVantageApiKey as string | undefined;

  constructor(private http: HttpClient) {}

  // Heuristik: Symbol-zu-CoinGecko-ID-Mapping (erweiterbar)
  private mapSymbolToCoinId(symbol: string): string | null {
    const sym = symbol.replace('-USD', '').toUpperCase();
    const map: Record<string, string> = {
      BTC: 'bitcoin',
      ETH: 'ethereum',
      SOL: 'solana',
      ADA: 'cardano',
      XRP: 'ripple',
      DOGE: 'dogecoin',
      LTC: 'litecoin',
      BNB: 'binancecoin',
      AVAX: 'avalanche-2',
      MATIC: 'matic-network',
    };
    return map[sym] ?? null;
  }

  // Binance Symbol Mapping
  private mapSymbolToBinancePair(symbol: string): string | null {
    const sym = symbol.toUpperCase();
    // Erwarte z. B. BTC-USD -> BTCUSDT
    if (sym.endsWith('-USD')) {
      const base = sym.replace('-USD', '');
      return `${base}USDT`;
    }
    // Falls bereits ohne Trennzeichen geliefert wurde
    if (/^[A-Z]{3,6}USDT$/.test(sym)) return sym;
    return null;
  }

  // Intervall-Mappings
  private mapIntervalToCoinGecko(interval: string): 'daily' | undefined {
    const i = interval.toLowerCase();
    return ['1d', '1day', 'daily'].includes(i) ? 'daily' : undefined;
  }

  private mapIntervalToAlpha(interval: string): string | null {
    const i = interval.toLowerCase();
    const map: Record<string, string> = {
      '1m': '1min',
      '5m': '5min',
      '15m': '15min',
      '30m': '30min',
      '60m': '60min',
      '1h': '60min',
    };
    return map[i] ?? null;
  }

  private mapIntervalToBinance(interval: string): string {
    const i = interval.toLowerCase();
    const map: Record<string, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '60m': '1h',
      '1d': '1d',
      '1wk': '1w',
      '1mo': '1M',
    };
    return map[i] ?? '1h';
  }

  // CoinGecko zuerst, dann Binance als Fallback
  fetchCryptoChart(symbol: string, range: string, interval: string): Observable<NormalizedChartResponse | null> {
    // Zuerst Binance (robust, kein Key), dann CoinGecko
    return this.fetchCryptoChartBinance(symbol, range, interval).pipe(
      switchMap((binanceRes) => {
        if (binanceRes?.data?.chart?.result?.[0]) return of(binanceRes);

        const coinId = this.mapSymbolToCoinId(symbol);
        const cgInterval = this.mapIntervalToCoinGecko(interval);
        const days = this.mapRangeToCoinGeckoDays(range);
        if (!coinId) return of(null);

        return this.http
          .get<any>(this.buildCoinGeckoUrl(coinId, days, cgInterval))
          .pipe(
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
      })
    );
  }

  private buildCoinGeckoUrl(coinId: string, days: number | 'max', cgInterval?: 'daily'): string {
    const base = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
    return cgInterval ? `${base}&interval=${cgInterval}` : base;
  }

  private fetchCryptoChartBinance(symbol: string, _range: string, interval: string): Observable<NormalizedChartResponse | null> {
    const pair = this.mapSymbolToBinancePair(symbol);
    if (!pair) return of(null);
    const binanceInterval = this.mapIntervalToBinance(interval);
    const limit = 1000; // Maximal zulässige Anzahl; reicht für Anzeige
    const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${binanceInterval}&limit=${limit}`;
    return this.http.get<any[]>(url).pipe(
      map((rows) => {
        if (!Array.isArray(rows) || !rows.length) return null;
        const timestamps = rows.map((r) => Math.floor((r[0] as number) / 1000)); // open time in ms
        const prices = rows.map((r) => parseFloat(r[4])); // close
        const volumes = rows.map((r) => parseFloat(r[5])); // volume
        if (!prices.length) return null;
        const data = this.toYahooChartFormat(timestamps, prices, volumes);
        return { source: 'binance' as const, data };
      }),
      catchError(() => of(null))
    );
  }

  fetchStockChart(symbol: string, _range: string, interval: string): Observable<NormalizedChartResponse | null> {
    if (!this.alphaVantageApiKey) return of(null);

    // Wähle passenden Alpha Vantage Endpoint
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
    return {
      chart: {
        result: [
          {
            timestamp: timestamps,
            indicators: {
              quote: [
                {
                  close: prices,
                  volume: volumes,
                },
              ],
            },
          },
        ],
      },
    };
  }

  private mapRangeToCoinGeckoDays(range: string): number | 'max' {
    switch (range) {
      case '1d':
      case 'DAY':
        return 1;
      case '5d':
      case 'WEEK':
        return 7;
      case '1m':
      case 'MONTH':
        return 30;
      case '3m':
      case 'THREE_MONTHS':
        return 90;
      case '6m':
      case 'SIX_MONTHS':
        return 180;
      case '1y':
      case 'YEAR':
        return 365;
      case '5y':
      case 'FIVE_YEARS':
        return 1825;
      default:
        return 30;
    }
  }
} 