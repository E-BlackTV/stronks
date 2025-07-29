import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';

export interface TradeRequest {
  user_id: number;
  action: 'buy' | 'sell';
  asset_symbol: string;
  euro_amount?: number;
  asset_quantity?: number;
  sell_percentage?: number;
}

export interface TradeResponse {
  success: boolean;
  message: string;
  data?: {
    action: string;
    asset_symbol: string;
    quantity: number;
    price_per_unit: number;
    total_amount: number;
    new_balance: number;
    portfolio_position?: any;
  };
}

export interface PortfolioItem {
  id: number;
  asset_symbol: string;
  asset_name: string;
  asset_type: string;
  quantity: number;
  avg_purchase_price: number;
  current_price: number;
  total_invested: number;
  current_value: number;
  profit_loss: number;
  profit_loss_percent: number;
  last_updated: string;
}

export interface PortfolioResponse {
  success: boolean;
  portfolio: PortfolioItem[];
  summary: {
    total_invested: number;
    total_value: number;
    total_profit_loss: number;
    total_profit_loss_percent: number;
    cash_balance: number;
    total_portfolio_value: number;
  };
}

export interface Transaction {
  id: number;
  asset_symbol: string;
  asset_name: string;
  asset_type: string;
  type: 'buy' | 'sell';
  quantity: number;
  price_per_unit: number;
  total_amount: number;
  transaction_date: string;
  formatted_date: string;
}

export interface TransactionsResponse {
  success: boolean;
  transactions: Transaction[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

@Injectable({
  providedIn: 'root',
})
export class TradingService {
  private apiUrl = '/backend';

  constructor(private http: HttpClient) {}

  // Trade (Kauf oder Verkauf)
  trade(request: TradeRequest): Observable<TradeResponse> {
    return this.http.post<TradeResponse>(`${this.apiUrl}/trade.php`, request);
  }

  // Portfolio abrufen
  getPortfolio(userId: number): Observable<PortfolioResponse> {
    return this.http.get<PortfolioResponse>(
      `${this.apiUrl}/get_portfolio_new.php?user_id=${userId}`
    );
  }

  // Transaktionshistorie abrufen
  getTransactions(
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Observable<TransactionsResponse> {
    return this.http.get<TransactionsResponse>(
      `${this.apiUrl}/get_transactions.php?user_id=${userId}&limit=${limit}&offset=${offset}`
    );
  }

  // Aktuellen Asset-Preis abrufen
  getAssetPrice(symbol: string): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/cache.php?symbol=${symbol}&range=1d&interval=5m`
    );
  }
}
