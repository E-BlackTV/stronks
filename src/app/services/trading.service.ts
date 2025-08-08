import { Injectable } from '@angular/core';
import { Observable, map, switchMap, of } from 'rxjs';
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
    private firestoreService: FirestoreService,
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

  // Portfolio abrufen
  getPortfolio(userId: string): Observable<PortfolioResponse> {
    return this.firestoreService.getPortfolioByUserId(userId).pipe(
      map((data) => {
        const assets = data?.assets ?? [];
        // totalValue kann clientseitig berechnet werden, wenn currentPrice vorhanden ist
        const totalValue = assets.reduce((sum: number, a: any) => sum + (a.quantity * (a.currentPrice || 0)), 0);
        return { success: true, assets, totalValue };
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
    return this.firestoreService.getLatestCachedData(symbol, '1d', '5m').pipe(
      map((cached) => {
        if (!cached) return { success: false };
        const prices = cached.data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
        const price = prices.length ? prices[prices.length - 1] : null;
        return price ? { success: true, price, symbol } : { success: false };
      })
    );
  }

  // Chart-Daten (aus cached_data)
  getChartData(symbol: string, range: string = '1d', interval: string = '5m'): Observable<any> {
    return this.firestoreService.getLatestCachedData(symbol, range, interval).pipe(
      switchMap((cached) => {
        if (cached?.data) {
          return of(this.normalizeChartPayload(cached.data));
        }
        // Live-Fetch: zuerst CoinGecko (für Krypto), dann Alpha Vantage (für Aktien), sonst generischer Fallback
        return this.marketData.fetchCryptoChart(symbol, range, interval).pipe(
          switchMap((cryptoRes) => {
            if (cryptoRes?.data?.chart?.result?.[0]) {
              // Für limitierte Quellen müssten wir nicht cachen; CoinGecko ist großzügig → optional kein Cache
              return of(cryptoRes.data);
            }
            return this.marketData.fetchStockChart(symbol, range, interval).pipe(
              switchMap((stockRes) => {
                if (stockRes?.data?.chart?.result?.[0]) {
                  // Alpha Vantage ist limitiert → Cache speichern
                  return this.firestoreService
                    .upsertCachedData({ symbol, rangePeriod: range, intervalPeriod: interval, data: stockRes.data, type: 'chart' })
                    .pipe(map(() => stockRes.data));
                }
                // Fallback: Nimm die neueste Cached-Data ohne Range/Interval-Filter
                return this.firestoreService.getCachedData(symbol).pipe(
                  map((list) => this.normalizeChartPayload(list?.[0]?.data ?? { chart: { result: [] } }))
                );
              })
            );
          })
        );
      })
    );
  }

  private normalizeChartPayload(payload: any): any {
    try {
      // Falls String gespeichert wurde
      if (typeof payload === 'string') {
        const parsed = JSON.parse(payload);
        return this.normalizeChartPayload(parsed);
      }
      // Direkte Yahoo-Struktur
      if (payload?.chart?.result?.[0]) {
        return payload;
      }
      // Verschachtelt unter data
      if (payload?.data?.chart?.result?.[0]) {
        return payload.data;
      }
      // Standard-Fallback
      return { chart: { result: [] } };
    } catch (_e) {
      return { chart: { result: [] } };
    }
  }
}
