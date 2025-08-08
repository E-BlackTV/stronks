import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';

// Diese Service-Klasse war zuvor für Firebase Callable Functions zuständig.
// Für Spark (Free) wird sie neutralisiert, damit keine Blaze-abhängigen Aufrufe nötig sind.

export interface TradeRequest {
  userId: string;
  assetSymbol: string;
  quantity: number;
  amount: number;
  currentPrice: number;
  action: 'buy' | 'sell';
}

export interface TradeResponse { success: boolean; message: string; }
export interface PortfolioResponse { success: boolean; assets: any[]; totalValue: number; }
export interface TransactionsResponse { success: boolean; transactions: any[]; }
export interface BalanceResponse { success: boolean; balance: number; }
export interface AssetPriceResponse { success: boolean; price: number; symbol: string; }
export interface LuckyWheelResponse { success: boolean; prizeAmount: number; prizePercentage: number; newBalance: number; message?: string; }

@Injectable({ providedIn: 'root' })
export class FirebaseBackendService {
  constructor(private http: HttpClient) {}

  // Platzhalter-Methoden, damit bestehende Aufrufe nicht crashen.
  // Empfohlen: Direkt TradingService/FirestoreService verwenden.
  executeTrade(_req: TradeRequest): Observable<TradeResponse> {
    return of({ success: false, message: 'Callable Functions deaktiviert. Verwenden Sie TradingService.' });
  }
  getPortfolio(_userId: string): Observable<PortfolioResponse> {
    return of({ success: true, assets: [], totalValue: 0 });
  }
  getBalance(_userId: string): Observable<BalanceResponse> {
    return of({ success: true, balance: 0 });
  }
  getAssetPrice(_symbol: string): Observable<AssetPriceResponse> {
    return of({ success: false, price: 0, symbol: '' });
  }
  spinLuckyWheel(_userId: string): Observable<LuckyWheelResponse> {
    return of({ success: false, prizeAmount: 0, prizePercentage: 0, newBalance: 0, message: 'Callable Functions deaktiviert' });
  }
  getTransactions(_userId: string, _limit: number = 50, _offset: number = 0): Observable<TransactionsResponse> {
    return of({ success: true, transactions: [] });
  }
  getChartData(_symbol: string, _range: string = '1d', _interval: string = '5m'): Observable<any> {
    return of({ chart: { result: [] } });
  }
} 