import { Component, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import axios from 'axios';
import { environment } from '../../environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { AuthenticationService } from '../services/authentication.service';
import { ModalController, ToastController } from '@ionic/angular'; // Add ToastController here
import { LuckyWheelComponent } from '../components/lucky-wheel/lucky-wheel.component';

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

enum TimePeriod {
  HOUR = '1h',
  DAY = '1d',
  WEEK = '1w',
  MONTH = '1m',
  YEAR = '1y',
}

interface TimeframeOption {
  label: string;
  value: TimePeriod;
  interval: string;
}

enum TimeRange {
  DAY = '1d',
  WEEK = '1w',
  MONTH = '1m',
  THREE_MONTHS = '3m',
  SIX_MONTHS = '6m',
  YEAR = '1y',
  FIVE_YEARS = '5y',
}

enum DataInterval {
  ONE_MINUTE = '1m',
  FIVE_MINUTES = '5m',
  FIFTEEN_MINUTES = '15m',
  THIRTY_MINUTES = '30m',
  ONE_HOUR = '1h',
  ONE_DAY = '1d',
  ONE_WEEK = '1wk',
  ONE_MONTH = '1mo',
}

interface RangeOption {
  label: string;
  value: TimeRange;
}

interface IntervalOption {
  label: string;
  value: DataInterval;
  allowedRanges: TimeRange[]; // Which time ranges this interval works with
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
  profitLoss: number = 0; // Add this property
  currentPrices: { [key: string]: number } = {
    Bitcoin: 0,
    Tesla: 0,
    Apple: 0,
    // Add other investment types here
  };
  selectedPeriod: TimePeriod = TimePeriod.DAY;
  timeframeOptions: TimeframeOption[] = [
    { label: '1 Hour', value: TimePeriod.HOUR, interval: '1m' },
    { label: '1 Day', value: TimePeriod.DAY, interval: '5m' },
    { label: '1 Week', value: TimePeriod.WEEK, interval: '15m' },
    { label: '1 Month', value: TimePeriod.MONTH, interval: '1d' },
    { label: '1 Year', value: TimePeriod.YEAR, interval: '1wk' },
  ];

  selectedRange: TimeRange = TimeRange.DAY;
  selectedInterval: DataInterval = DataInterval.FIVE_MINUTES;

  rangeOptions: RangeOption[] = [
    { label: 'Last Day', value: TimeRange.DAY },
    { label: 'Last Week', value: TimeRange.WEEK },
    { label: 'Last Year', value: TimeRange.YEAR },
    { label: 'Last 5 Years', value: TimeRange.FIVE_YEARS },
  ];

  intervalOptions: IntervalOption[] = [
    {
      label: '5 Minutes',
      value: DataInterval.FIVE_MINUTES,
      allowedRanges: [TimeRange.DAY, TimeRange.WEEK, TimeRange.MONTH],
    },
    {
      label: '15 Minutes',
      value: DataInterval.FIFTEEN_MINUTES,
      allowedRanges: [TimeRange.DAY, TimeRange.WEEK, TimeRange.MONTH],
    },
    {
      label: '30 Minutes',
      value: DataInterval.THIRTY_MINUTES,
      allowedRanges: [TimeRange.WEEK, TimeRange.MONTH],
    },
    {
      label: '1 Hour',
      value: DataInterval.ONE_HOUR,
      allowedRanges: [TimeRange.WEEK, TimeRange.MONTH, TimeRange.THREE_MONTHS],
    },
    {
      label: '1 Day',
      value: DataInterval.ONE_DAY,
      allowedRanges: [
        TimeRange.MONTH,
        TimeRange.THREE_MONTHS,
        TimeRange.SIX_MONTHS,
        TimeRange.YEAR,
      ],
    },
    {
      label: '1 Week',
      value: DataInterval.ONE_WEEK,
      allowedRanges: [
        TimeRange.SIX_MONTHS,
        TimeRange.YEAR,
        TimeRange.FIVE_YEARS,
      ],
    },
    {
      label: '1 Month',
      value: DataInterval.ONE_MONTH,
      allowedRanges: [TimeRange.YEAR, TimeRange.FIVE_YEARS],
    },
  ];

  showInvestments: boolean = false;
  userInvestments: any[] = [];

  constructor(
    private http: HttpClient,
    private authService: AuthenticationService,
    private modalController: ModalController,
    private toastController: ToastController // Add this line
  ) {
    Chart.register(...registerables);
    this.refreshSubscription = interval(10000).subscribe(() => {
      this.fetchAccountBalance();
    });

    // Get user ID from auth service
    const currentUser = this.authService.currentUserValue;
    if (currentUser) {
      this.userId = currentUser.id;
    }
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
    try {
      // Get the selected interval option to use its configuration
      const selectedIntervalOption = this.intervalOptions.find(
        (option) => option.value === this.selectedInterval
      );

      if (!selectedIntervalOption) {
        console.error('No valid interval selected');
        return;
      }

      const options = {
        method: 'GET',
        url: environment.apiUrl + '/cache.php',
        params: {
          symbol: 'BTC-USD',
          range: this.selectedRange,
          interval: this.selectedInterval,
        },
      };

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

      const result = data.chart.result[0];
      const prices = result.indicators?.quote[0]?.close || [];
      const timestamps = result.timestamp || [];
      const volumes = result.indicators?.quote[0]?.volume || [];

      // Format dates based on selected range and interval
      const labels = timestamps.map((timestamp: number) => {
        const date = new Date(timestamp * 1000);
        switch (this.selectedRange) {
          case TimeRange.DAY:
            return date.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
          case TimeRange.WEEK:
            return date.toLocaleDateString([], { weekday: 'short' });
          case TimeRange.MONTH:
            return date.toLocaleDateString([], {
              day: 'numeric',
              month: 'short',
            });
          case TimeRange.THREE_MONTHS:
          case TimeRange.SIX_MONTHS:
            return date.toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
            });
          case TimeRange.YEAR:
          case TimeRange.FIVE_YEARS:
            return date.toLocaleDateString([], {
              month: 'short',
              year: '2-digit',
            });
          default:
            return date.toLocaleDateString();
        }
      });

      // Update chart with new data
      this.createChart(prices, labels);

      // Update current price and other data
      this.currentPrice = prices[prices.length - 1] || 0;
      this.calculateShares();
      await this.calculatePortfolioValue();

      // Update table data
      this.tableData = timestamps.map((timestamp: number, index: number) => ({
        date: labels[index],
        price: prices[index]?.toFixed(2) || 'N/A',
        volume: volumes[index]?.toLocaleString() || 'N/A',
      }));

      console.log('Chart data updated:', {
        range: this.selectedRange,
        interval: this.selectedInterval,
        dataPoints: prices.length,
        currentPrice: this.currentPrice,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

  createChart(prices: number[], labels: string[]) {
    if (this.chart) {
      this.chart.destroy();
    }

    if (!this.lineChart?.nativeElement) {
      console.error('Canvas element not found!');
      return;
    }

    this.chart = new Chart(this.lineChart.nativeElement, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Bitcoin Preis (USD)',
            data: prices,
            borderColor: '#4caf50',
            backgroundColor: 'rgba(76, 175, 80, 0.2)',
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 6,
            borderWidth: 2,
            tension: 0.4, // Smooth curve
            cubicInterpolationMode: 'monotone',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animations: {
          tension: {
            duration: 1000,
            easing: 'linear',
            from: 0.8,
            to: 0.4,
            loop: false,
          },
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: {
                size: 14,
                weight: 'bold',
              },
              padding: 20,
            },
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleFont: {
              size: 16,
              weight: 'bold',
            },
            bodyFont: {
              size: 14,
            },
            padding: 12,
            displayColors: false,
            callbacks: {
              label: function (context) {
                return `Price: $${context.parsed.y.toFixed(2)}`;
              },
            },
          },
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        hover: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              font: {
                size: 12,
              },
              maxRotation: 45,
              minRotation: 45,
            },
          },
          y: {
            position: 'right',
            grid: {
              color: 'rgba(200, 200, 200, 0.2)',
            },
            ticks: {
              font: {
                size: 12,
                weight: 'bold',
              },
              callback: function (value) {
                return '$' + value.toLocaleString();
              },
            },
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
        // Calculate total invested amount
        const totalInvested =
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
            return total + currentValue;
          },
          0
        );

        this.portfolioValue = this.accountBalance + investmentValue;

        // Calculate absolute profit/loss in USD
        this.profitLoss = this.portfolioValue - totalInvested;

        // Calculate percentage for color indication
        this.profitLossPercentage =
          ((this.portfolioValue - totalInvested) / totalInvested) * 100;

        console.log('Portfolio details:', {
          accountBalance: this.accountBalance,
          investmentValue: investmentValue,
          portfolioValue: this.portfolioValue,
          profitLoss: this.profitLoss,
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

  onPeriodChange(event: any) {
    this.selectedPeriod = event.detail.value;
    this.fetchData();
  }

  getAvailableIntervals(): IntervalOption[] {
    return this.intervalOptions.filter((interval) =>
      interval.allowedRanges.includes(this.selectedRange)
    );
  }

  onRangeChange(event: any) {
    this.selectedRange = event.detail.value;
    // Check if current interval is valid for new range
    if (
      !this.getAvailableIntervals().find(
        (i) => i.value === this.selectedInterval
      )
    ) {
      // Set to first available interval
      this.selectedInterval = this.getAvailableIntervals()[0].value;
    }
    this.fetchData();
  }

  onIntervalChange(event: any) {
    this.selectedInterval = event.detail.value;
    this.fetchData();
  }

  async openLuckyWheel() {
    const modal = await this.modalController.create({
      component: LuckyWheelComponent,
      cssClass: 'lucky-wheel-modal',
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data?.refresh) {
      this.fetchAccountBalance();
    }
  }

  logout() {
    this.authService.logout();
  }

  toggleInvestments() {
    this.showInvestments = !this.showInvestments;
    if (this.showInvestments) {
      this.fetchUserInvestments();
    }
  }

  async fetchUserInvestments() {
    try {
      const response = await this.http
        .get<any>(
          `http://localhost/stronks/backend/get_portfolio.php?user_id=${this.userId}`
        )
        .toPromise();

      if (response && response.success) {
        this.userInvestments = response.investments.map((inv: any) => ({
          ...inv,
          // Calculate shares based on amount and purchase price
          calculatedShares:
            parseFloat(inv.amount) / parseFloat(inv.purchase_price),
          // Calculate current value based on calculated shares and current price
          currentValue:
            (parseFloat(inv.amount) / parseFloat(inv.purchase_price)) *
            this.currentPrice,
        }));
      }
    } catch (error) {
      console.error('Error fetching investments:', error);
    }
  }

  async sellInvestment(investmentId: number) {
    try {
      const response = await this.http
        .post<any>('http://localhost/stronks/backend/sellInvestment.php', {
          user_id: this.userId,
          investment_id: investmentId,
        })
        .toPromise();

      if (response && response.success) {
        // Refresh data
        await this.fetchUserInvestments();
        await this.fetchAccountBalance();
        await this.calculatePortfolioValue();

        // Show success message
        const toast = await this.toastController.create({
          message: 'Investment erfolgreich verkauft!',
          duration: 2000,
          color: 'success',
        });
        toast.present();
      }
    } catch (error) {
      console.error('Error selling investment:', error);
    }
  }

  async onBuyConfirm(purchaseData: any) {
    try {
      const response = await this.http
        .post<PurchaseResponse>(
          'http://localhost/stronks/backend/buy.php',
          purchaseData
        )
        .toPromise();

      if (response && response.success) {
        // Refresh all relevant data
        await this.fetchAccountBalance();
        await this.fetchUserInvestments(); // Add this line
        await this.calculatePortfolioValue();
        this.showInvestments = true; // Automatically show investments panel

        const toast = await this.toastController.create({
          message: 'Investment erfolgreich!',
          duration: 2000,
          color: 'success',
        });
        toast.present();
      }
    } catch (error) {
      console.error('Error making purchase:', error);
      const toast = await this.toastController.create({
        message: 'Fehler beim Kauf',
        duration: 2000,
        color: 'danger',
      });
      toast.present();
    }
  }
}
