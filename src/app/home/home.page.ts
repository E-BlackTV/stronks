import { Component, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import axios from 'axios';
import { environment } from '../../environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';

interface PurchaseResponse {
  success: boolean;
  message: string;
}

interface PurchaseData {
  user_id: number;
  investments: string; // Asset type (e.g., 'Bitcoin')
  shares: number; // calculatedShares
  amount: number; // investmentAmount
  purchase_price: number; // Price at purchase time
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit, OnDestroy {
  @ViewChild('lineChart', { static: false }) lineChart: any;
  chart: any;
  tableData: any[] = [];
  investmentAmount: number = 0;
  currentPrice: number = 0;
  calculatedShares: number = 0;
  accountBalance: number = 0;
  portfolioValue: number = 0;
  userId: number = 9; //Test-User-ID
  readonly ASSET_TYPE: string = 'Bitcoin'; //could make this dynamic if needed
  private refreshSubscription: Subscription;
  initialInvestment: number = 0;
  profitLossPercentage: number = 0;
  currentPrices: { [key: string]: number } = {
    Bitcoin: 0,
    Tesla: 0,
    Apple: 0,
    // Add other investment types here
  };

  constructor(private http: HttpClient) {
    Chart.register(...registerables);
    // Set up auto-refresh every 10 seconds
    this.refreshSubscription = interval(10000).subscribe(() => {
      this.fetchAccountBalance();
    });
  }

  async ngOnInit() {
    await this.fetchAccountBalance();
    await this.fetchAllCurrentPrices();
    await this.fetchData();
    await this.calculatePortfolioValue();
  }

  ngOnDestroy() {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  ionViewDidEnter() {
    this.fetchData();
  }

  async fetchAccountBalance() {
    try {
      const response = await this.http
        .get<any>(
          `http://localhost/stronks/backend/get_balance.php?user_id=${this.userId}`
        )
        .toPromise();

      if (response && response.success) {
        this.accountBalance = response.balance;
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  }

  async fetchData() {
    const options = {
      method: 'GET',
      url: environment.apiUrl + '/cache.php',
      withCredentials: true,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    };

    try {
      const response = await axios.request(options);
      console.log('API Response:', response.data);

      if (response.data.error) {
        console.error('API Error:', response.data.error);
        return;
      }

      const data = response.data;
      if (!data.chart?.result?.[0]) {
        console.error('Unexpected data format:', data);
        return;
      }

      const prices = data.chart.result[0].indicators?.quote[0]?.close || [];
      const timestamps = data.chart.result[0].timestamp || [];
      const volumes = data.chart.result[0].indicators?.quote[0]?.volume || [];

      // Format data for table
      this.tableData = timestamps.map((timestamp: number, index: number) => {
        const date = new Date(timestamp * 1000);
        return {
          date: `${date.getDate()}/${
            date.getMonth() + 1
          }/${date.getFullYear()}`,
          price: prices[index]?.toFixed(2) || 'N/A',
          volume: volumes[index]?.toLocaleString() || 'N/A',
        };
      });

      // Zeitstempel in lesbare Daten umwandeln
      const labels = timestamps.map((timestamp: number) => {
        const date = new Date(timestamp * 1000); // Unix-Timestamp in Millisekunden
        return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
      });

      console.log('Prices:', prices);
      console.log('Labels:', labels);

      this.createChart(prices, labels);

      // Aktualisiere den aktuellen Preis
      this.currentPrice =
        data.chart.result[0].indicators?.quote[0]?.close.slice(-1)[0] || 0;
      this.calculateShares();
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
    }
  }

  createChart(prices: number[], labels: string[]) {
    console.log('Creating chart with prices:', prices);

    if (this.chart) {
      this.chart.destroy(); // Chart resetten, wenn schon einer existiert
    }

    if (!this.lineChart?.nativeElement) {
      console.error('Canvas element not found!');
      return;
    }

    this.chart = new Chart(this.lineChart.nativeElement, {
      type: 'line',
      data: {
        labels: labels, // Zeitstempel als Labels
        datasets: [
          {
            label: 'Bitcoin Preis (USD)',
            data: prices, // Historische Preise
            borderColor: '#4caf50',
            backgroundColor: 'rgba(76, 175, 80, 0.2)',
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: true,
            position: 'top',
          },
        },
      },
    });
  }

  // Berechne die Anteile basierend auf dem Investitionsbetrag
  calculateShares() {
    if (this.currentPrice && this.investmentAmount) {
      this.calculatedShares = this.investmentAmount / this.currentPrice;
    }
  }

  // Kauflogik
  async buyBitcoin() {
    if (!this.investmentAmount || !this.currentPrice) {
      return;
    }

    // Nutze this.calculatedShares anstatt neu zu berechnen
    const purchaseData = {
      user_id: this.userId,
      investments: this.ASSET_TYPE,
      shares: this.calculatedShares, // Verwende die bereits berechneten shares
      amount: this.investmentAmount,
      purchase_price: this.currentPrice,
    };

    // Log zum Debugging
    console.log('Purchase Data being sent:', purchaseData);

    try {
      const response = await this.http
        .post<PurchaseResponse>(
          'http://localhost/stronks/backend/buy.php',
          purchaseData,
          {
            withCredentials: true,
            headers: new HttpHeaders({
              'Content-Type': 'application/json',
              Accept: 'application/json',
            }),
          }
        )
        .toPromise();

      console.log('Purchase response:', response);

      if (response?.success) {
        // Using optional chaining
        alert('Kauf erfolgreich!');
        this.investmentAmount = 0;
        this.calculatedShares = 0;
        await this.fetchAccountBalance(); // Refresh balance after successful purchase
        await this.calculatePortfolioValue(); // Add this line
        await this.fetchData();
      } else {
        alert(response?.message || 'Kauf fehlgeschlagen');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      alert('Kauf fehlgeschlagen. Bitte versuchen Sie es erneut.');
    }
  }

  async fetchAllCurrentPrices() {
    // Fetch current prices for all investment types
    this.currentPrices['Bitcoin'] = this.currentPrice; // Bitcoin price from existing code
    // Add API calls for other investment types
    // Example:
    // this.currentPrices['Tesla'] = await this.fetchStockPrice('TSLA');
  }

  async calculatePortfolioValue() {
    try {
      const response = await this.http
        .get<any>(
          `http://localhost/stronks/backend/get_portfolio.php?user_id=${this.userId}`
        )
        .toPromise();

      if (response && response.success) {
        // Calculate total invested amount (Startkapital)
        this.initialInvestment =
          response.investments.reduce((total: number, investment: any) => {
            return total + parseFloat(investment.amount);
          }, 0) + this.accountBalance;

        // Calculate current value of investments
        const investmentValue = response.investments.reduce(
          (total: number, investment: any) => {
            const shares =
              parseFloat(investment.amount) /
              parseFloat(investment.purchase_price);
            const currentValue = shares * this.currentPrice;

            console.log('Investment calculation:', {
              amount: investment.amount,
              purchasePrice: investment.purchase_price,
              shares: shares,
              currentBitcoinPrice: this.currentPrice,
              calculatedValue: currentValue,
            });

            return total + currentValue;
          },
          0
        );

        this.portfolioValue = this.accountBalance + investmentValue;

        // Calculate profit/loss percentage
        if (this.initialInvestment > 0) {
          this.profitLossPercentage =
            ((this.portfolioValue - this.initialInvestment) /
              this.initialInvestment) *
            100;
        }

        console.log('Portfolio details:', {
          accountBalance: this.accountBalance,
          initialInvestment: this.initialInvestment,
          currentInvestmentValue: investmentValue,
          portfolioValue: this.portfolioValue,
          profitLossPercentage: this.profitLossPercentage,
        });
      }
    } catch (error) {
      console.error('Error calculating portfolio value:', error);
    }
  }

  calculatePercentageChange(
    current_price: number,
    purchase_price: number
  ): number {
    return ((current_price - purchase_price) / purchase_price) * 100;
  }
}
