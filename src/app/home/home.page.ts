import { Component, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import axios from 'axios';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { AuthenticationService } from '../services/authentication.service';
import { TradingService } from '../services/trading.service';
import { ModalController, ToastController } from '@ionic/angular';
import { LuckyWheelComponent } from '../components/lucky-wheel/lucky-wheel.component';
import { TradePopupComponent } from '../components/trade-popup/trade-popup.component';
import { environment } from '../../environments/environment';

interface PurchaseResponse {
  success: boolean;
  message: string;
}

interface PurchaseData {
  user_id: number;
  investments: string;
  shares: number;
  amount: number;
  purchase_price: number;
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
  allowedRanges: TimeRange[];
}

interface CryptoAsset {
  name: string;
  symbol: string;
  price: number;
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
  currentPrice: number = 0;
  calculatedShares: number = 0;
  selectedCrypto: CryptoAsset | null = null;
  selectedCryptoSymbol: string = 'BTC-USD'; // Add this property to track selected crypto
  selectedCryptoName: string = 'Bitcoin'; // Add this property to track selected crypto name

  accountBalance: number = 0;
  portfolioValue: number = 0;
  userId: number = this.authService.currentUserValue?.id || 0;
  readonly ASSET_TYPE: string = 'Bitcoin';
  private refreshSubscription: Subscription;
  initialInvestment: number = 0;
  profitLossPercentage: number = 0;
  profitLoss: number = 0;
  currentPrices: { [key: string]: number } = {
    Bitcoin: 0,
    Tesla: 0,
    Apple: 0,
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
  
  // Trading-Popup
  showTradePopup = false;
  tradeAction: 'buy' | 'sell' = 'buy';
  currentUser: any;
  
  // Crypto properties
  showCryptoList: boolean = false;
  cryptoAssets: CryptoAsset[] = [];
  investmentAmount: number = 0;

  constructor(
    private http: HttpClient,
    private authService: AuthenticationService,
    private tradingService: TradingService,
    private modalController: ModalController,
    private toastController: ToastController
  ) {
    Chart.register(...registerables);
    this.refreshSubscription = interval(10000).subscribe(() => {
      this.fetchAccountBalance();
    });

    const currentUser = this.authService.currentUserValue;
    if (currentUser) {
      this.userId = currentUser.id;
    }
  }

  ngOnInit() {
    this.initializeData();
    this.toggleInvestments();
  }

  async initializeData() {
    try {
      // Benutzer einloggen falls nicht angemeldet
      const user = this.authService.getCurrentUser();
      if (!user) {
        this.authService.login('testuser', 'test').subscribe((success) => {
          if (success) {
            this.currentUser = this.authService.getCurrentUser();
            this.loadAllData();
          }
        });
      } else {
        this.currentUser = user;
        this.loadAllData();
        this.loadPortfolio(); // Load portfolio on init
      }
    } catch (error) {
      console.error('Fehler beim Initialisieren:', error);
    }
  }

  async loadAllData() {
    await this.calculatePortfolioValue(); // Dies lädt auch die Balance und userInvestments
    await this.fetchAllCurrentPrices();
    await this.fetchDataForSelectedCrypto();
  }

  ngOnDestroy() {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  ionViewDidEnter() {
    this.fetchDataForSelectedCrypto();
  }

  // Trading-Funktionen
  openBuyPopup() {
    this.tradeAction = 'buy';
    this.showTradePopup = true;
  }

  openSellPopup() {
    this.tradeAction = 'sell';
    this.showTradePopup = true;
  }

  closeTradePopup() {
    this.showTradePopup = false;
  }

  onTradeCompleted(tradeData: any) {
    // Nur einen einzigen API-Aufruf für alle Daten
    this.loadAllData();

    // Erfolgsmeldung anzeigen
    this.showToast('Trade erfolgreich ausgeführt!', 'success');
  }

  async openTradePopup(
    action: 'buy' | 'sell',
    assetSymbol: string,
    currentPrice: number
  ) {
    // Für Verkauf: Verwende bereits geladene Daten anstatt neue API-Aufrufe
    let availableQuantity = 0;

    if (action === 'sell') {
      // Verwende bereits geladene userInvestments anstatt neue API-Aufrufe
      const portfolioItem = this.userInvestments.find(
        (item) => item.asset_symbol === assetSymbol
      );

      if (portfolioItem) {
        availableQuantity =
          portfolioItem.quantity || portfolioItem.calculatedShares || 0;
      }
    }

    const modal = await this.modalController.create({
      component: TradePopupComponent,
      componentProps: {
        action: action,
        assetSymbol: assetSymbol,
        currentPrice: currentPrice,
        userBalance: this.accountBalance,
        availableQuantity: availableQuantity,
      },
    });

    await modal.present();

    const result = await modal.onDidDismiss();

    // Nur nach Trade aktualisieren, nicht bei jedem Popup-Öffnen
    if (result.data && result.data.refresh) {
      await this.loadAllData();
    }
  }

  async onLuckyWheelWin() {
    // Balance nach Lucky Wheel Gewinn aktualisieren
    this.showToast('Gewinn erhalten!', 'success');
    await this.fetchAccountBalance();
    await this.calculatePortfolioValue();
    await this.loadPortfolio();
  }

  getBitcoinQuantity(): number {
    // Berechne die verfügbare Bitcoin-Menge aus dem Portfolio
    let totalBitcoin = 0;

    // Verwende das neue Portfolio-System
    if (this.userInvestments && this.userInvestments.length > 0) {
      const bitcoinInvestments = this.userInvestments.filter(
        (inv) => inv.asset_symbol === 'BTC-USD' || inv.investments === 'Bitcoin'
      );
      bitcoinInvestments.forEach((inv) => {
        // Verwende quantity aus dem neuen Portfolio-System
        totalBitcoin += inv.quantity || inv.calculatedShares || 0;
      });
    }

    return totalBitcoin;
  }

  async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      color: color,
      position: 'top',
    });
    toast.present();
  }

  async fetchAccountBalance() {
    try {
      const user = this.authService.getCurrentUser();
      if (user) {
        // Balance direkt von der API abrufen
        this.http.get(`/backend/get_balance.php?user_id=${user.id}`).subscribe({
          next: (response: any) => {
            if (response.success) {
              this.accountBalance = response.balance;
              console.log(
                'Account balance loaded from API:',
                this.accountBalance
              );

              // Aktualisiere auch den localStorage
              const currentUser = this.authService.getCurrentUser();
              if (currentUser) {
                currentUser.accountbalance = this.accountBalance;
                localStorage.setItem(
                  'currentUser',
                  JSON.stringify(currentUser)
                );
              }
            } else {
              console.error('Error loading balance:', response.message);
            }
          },
          error: (error) => {
            console.error('Error fetching balance from API:', error);
            // Fallback auf localStorage
            this.accountBalance = user.accountbalance || 0;
          },
        });
      } else {
        console.error('No user found');
        this.accountBalance = 0;
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
      this.accountBalance = 0;
    }
  }

  async fetchData() {
    try {
      const selectedIntervalOption = this.intervalOptions.find(
        (option) => option.value === this.selectedInterval
      );

      if (!selectedIntervalOption) {
        console.error('No valid interval selected');
        return;
      }

      const options = {
        method: 'GET',
        url: '/backend/cache.php',
        params: {
          symbol: this.selectedCryptoSymbol,
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

      this.createChart(prices, labels);

      this.currentPrice = prices[prices.length - 1] || 0;
      await this.calculatePortfolioValue();

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

    const mintColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent-turquoise')
      .trim();

    this.chart = new Chart(this.lineChart.nativeElement, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Bitcoin Preis (USD)',
            data: prices,
            borderColor: mintColor,
            backgroundColor: mintColor + '33',
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 6,
            borderWidth: 2,
            tension: 0.4,
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

  async fetchAllCurrentPrices() {

    try {
      this.http
        .get<any>(`/backend/cache.php?symbol=${this.selectedCryptoSymbol}&range=1d&interval=5m`)
        .subscribe({
          next: (response) => {
            if (response && response.chart?.result?.[0]) {
              const result = response.chart.result[0];
              const prices = result.indicators?.quote[0]?.close || [];
              if (prices.length > 0) {
                this.currentPrice = prices[prices.length - 1];
                this.currentPrices[this.selectedCryptoName] = this.currentPrice;
              }
            }
          },
          error: (error) => {
            console.error('Error fetching current prices:', error);
          },
        });
    } catch (error) {
      console.error('Error fetching current prices:', error);
    }
  }

  async calculatePortfolioValue() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) {
        this.portfolioValue = 0;
        this.profitLoss = 0;
        this.profitLossPercentage = 0;
        return;
      }

      // Verwende das neue Portfolio-System
      this.tradingService.getPortfolio(user.id).subscribe({
        next: (response) => {
          if (response.success) {
            this.portfolioValue = response.summary.total_portfolio_value;
            this.profitLoss = response.summary.total_profit_loss;
            this.profitLossPercentage =
              response.summary.total_profit_loss_percent;

            // Aktualisiere auch die Balance aus dem Portfolio
            this.accountBalance = response.summary.cash_balance;

            // Aktualisiere auch die userInvestments
            this.userInvestments = response.portfolio.map((item) => ({
              id: item.id,
              asset_symbol: item.asset_symbol,
              investments: item.asset_name || this.getAssetNameFromSymbol(item.asset_symbol),
              calculatedShares: item.quantity,
              currentValue: item.current_value,
              purchase_price: item.avg_purchase_price,
              amount: item.total_invested,
              quantity: item.quantity,
              profit_loss: item.profit_loss,
              profit_loss_percent: item.profit_loss_percent,
            }));

            console.log('Portfolio updated:', {
              totalValue: this.portfolioValue,
              profitLoss: this.profitLoss,
              profitLossPercentage: this.profitLossPercentage,
              cashBalance: this.accountBalance,
            });
          } else {
            console.error('Portfolio response not successful:', response);
            this.portfolioValue = 0;
            this.profitLoss = 0;
            this.profitLossPercentage = 0;
          }
        },
        error: (error) => {
          console.error('Error fetching portfolio:', error);
          this.portfolioValue = 0;
          this.profitLoss = 0;
          this.profitLossPercentage = 0;
        },
      });
    } catch (error) {
      console.error('Error calculating portfolio value:', error);
      this.portfolioValue = 0;
      this.profitLoss = 0;
      this.profitLossPercentage = 0;
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
    if (
      !this.getAvailableIntervals().find(
        (i) => i.value === this.selectedInterval
      )
    ) {
      this.selectedInterval = this.getAvailableIntervals()[0].value;
    }
    this.fetchDataForSelectedCrypto();
  }

  onIntervalChange(event: any) {
    this.selectedInterval = event.detail.value;
    this.fetchDataForSelectedCrypto();
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

  async toggleInvestments() {
    this.showInvestments = !this.showInvestments;
    if (this.showInvestments) {
      await this.fetchUserInvestments();
    }
  }

  async fetchUserInvestments() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) {
        this.userInvestments = [];
        return;
      }

      // Verwende das neue Portfolio-System
      this.tradingService.getPortfolio(user.id).subscribe({
        next: (response) => {
          if (response.success) {
            // Konvertiere Portfolio-Daten in das alte Format für Kompatibilität
            this.userInvestments = response.portfolio.map((item) => ({
              id: item.id,
              asset_symbol: item.asset_symbol,
              investments: item.asset_name || this.getAssetNameFromSymbol(item.asset_symbol),
              calculatedShares: item.quantity,
              currentValue: item.current_value,
              purchase_price: item.avg_purchase_price,
              amount: item.total_invested,
              quantity: item.quantity,
              profit_loss: item.profit_loss,
              profit_loss_percent: item.profit_loss_percent,
            }));

            console.log(
              'User investments updated:',
              this.userInvestments.length,
              'items'
            );
          } else {
            console.error('Portfolio response not successful:', response);
            this.userInvestments = [];
          }
        },
        error: (error) => {
          console.error('Error fetching investments:', error);
          this.userInvestments = [];
        },
      });
    } catch (error) {
      console.error('Error fetching user investments:', error);
      this.userInvestments = [];
    }
  }

  async sellInvestment(investmentId: number) {
    // Diese Methode wird nicht mehr verwendet - Verkauf läuft über das Trade-Popup
    console.log('sellInvestment deprecated - use Trade-Popup instead');
  }

  async loadPortfolio() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) {
        console.error('Kein Benutzer angemeldet');
        return;
      }

      this.tradingService.getPortfolio(user.id).subscribe({
        next: (response) => {
          if (response.success) {
            // Verwende die Portfolio-Daten direkt
            this.userInvestments = response.portfolio.map((item) => ({
              id: item.id,
              asset_symbol: item.asset_symbol,
              investments: item.asset_name || this.getAssetNameFromSymbol(item.asset_symbol),
              calculatedShares: item.quantity,
              currentValue: item.current_value,
              purchase_price: item.avg_purchase_price,
              amount: item.total_invested,
              quantity: item.quantity,
              profit_loss: item.profit_loss,
              profit_loss_percent: item.profit_loss_percent,
            }));

            this.portfolioValue = response.summary.total_portfolio_value;
            this.accountBalance = response.summary.cash_balance;
            this.profitLoss = response.summary.total_profit_loss;
            this.profitLossPercentage =
              response.summary.total_profit_loss_percent;

            console.log('Portfolio loaded successfully');
          } else {
            console.error('Fehler beim Laden des Portfolios:', response);
          }
        },
        error: (error) => {
          console.error('Fehler beim Laden des Portfolios:', error);
        },
      });
    } catch (error) {
      console.error('Fehler beim Laden des Portfolios:', error);
    }
  }

  async buyCrypto() {
    if (
      !this.selectedCrypto ||
      !this.investmentAmount ||
      !this.calculatedShares
    ) {
      return;
    }

    const purchaseData: PurchaseData = {
      user_id: this.userId,
      investments: this.selectedCrypto.name,
      shares: this.calculatedShares,
      amount: this.investmentAmount,
      purchase_price: this.selectedCrypto.price,
    };

    try {
      const response = await this.http
        .post<PurchaseResponse>(`${environment.apiUrl}/buy.php`, purchaseData)
        .toPromise();

      if (response && response.success) {
        await this.fetchAccountBalance();
        await this.fetchUserInvestments();
        this.investmentAmount = 0;
        this.calculatedShares = 0;

        const toast = await this.toastController.create({
          message: `${this.selectedCrypto.name} erfolgreich gekauft!`,
          duration: 2000,
          color: 'success',
        });
        toast.present();
      } else {
        throw new Error(response?.message || 'Purchase failed');
      }
    } catch (error) {
      console.error('Error buying crypto:', error);
      const toast = await this.toastController.create({
        message: 'Fehler beim Kauf. Bitte versuchen Sie es erneut.',
        duration: 2000,
        color: 'danger',
      });
      toast.present();
    }
  }

  async fetchCryptoData() {
    if (!this.selectedCrypto) return;

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
          symbol: `${this.selectedCrypto.symbol}-USD`,
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

      // Update selected crypto price and shares
      this.selectedCrypto.price = prices[prices.length - 1] || 0;
      this.calculateShares();

      console.log('Chart data updated for', this.selectedCrypto.name, {
        range: this.selectedRange,
        interval: this.selectedInterval,
        dataPoints: prices.length,
        currentPrice: this.selectedCrypto.price,
      });
    } catch (error) {
      console.error('Error fetching crypto data:', error);
    }
  }

  formatDateLabel(date: Date): string {
    switch (this.selectedRange) {
      case TimeRange.DAY:
        return date.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
      case TimeRange.WEEK:
        return date.toLocaleDateString([], { weekday: 'short' });
      default:
        return date.toLocaleDateString();
    }
  }

  async fetchCryptoAssets() {
    try {
      // Hole alle Crypto-Assets aus dem Backend
      const response = await this.http
        .get<any>(`${environment.apiUrl}/get_crypto_assets.php`)
        .toPromise();
      if (response && response.success) {
        this.cryptoAssets = response.assets;
        this.showCryptoList = true;
        this.showInvestments = false;

        // If we have a selectedCrypto, update its price
        if (this.selectedCrypto) {
          const updatedAsset = this.cryptoAssets.find(
            (asset) => asset.symbol === this.selectedCrypto?.symbol
          );
          if (updatedAsset) {
            this.selectedCrypto = updatedAsset;
            this.calculateShares();
          }
        }
      }
    } catch (error) {
      console.error('Error fetching crypto assets:', error);
      const toast = await this.toastController.create({
        message: 'Fehler beim Laden der Kryptowährungen',
        duration: 2000,
        color: 'danger',
      });
      toast.present();
    }
  }

  calculateShares() {
    if (this.selectedCrypto && this.investmentAmount > 0) {
      this.calculatedShares = this.investmentAmount / this.selectedCrypto.price;
    } else {
      this.calculatedShares = 0;
    }
  }

  // Add method to handle crypto selection
  async selectCrypto(asset: CryptoAsset) {
    this.selectedCrypto = asset;
    this.selectedCryptoSymbol = `${asset.symbol}-USD`;
    this.selectedCryptoName = asset.name;
    
    // Update the chart and data for the selected crypto
    await this.fetchDataForSelectedCrypto();
    
    console.log('Selected crypto:', {
      name: this.selectedCryptoName,
      symbol: this.selectedCryptoSymbol,
      price: asset.price
    });
  }

  // Add method to fetch data for the selected crypto
  async fetchDataForSelectedCrypto() {
    try {
      const selectedIntervalOption = this.intervalOptions.find(
        (option) => option.value === this.selectedInterval
      );

      if (!selectedIntervalOption) {
        console.error('No valid interval selected');
        return;
      }

      const options = {
        method: 'GET',
        url: '/backend/cache.php',
        params: {
          symbol: this.selectedCryptoSymbol,
          range: this.selectedRange,
          interval: this.selectedInterval,
        },
      };

      const response = await axios.request(options);
      console.log('API Response for selected crypto:', response.data);

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

      this.createChartForSelectedCrypto(prices, labels);

      this.currentPrice = prices[prices.length - 1] || 0;
      await this.calculatePortfolioValue();

      this.tableData = timestamps.map((timestamp: number, index: number) => ({
        date: labels[index],
        price: prices[index]?.toFixed(2) || 'N/A',
        volume: volumes[index]?.toLocaleString() || 'N/A',
      }));

      console.log('Chart data updated for selected crypto:', {
        crypto: this.selectedCryptoName,
        symbol: this.selectedCryptoSymbol,
        range: this.selectedRange,
        interval: this.selectedInterval,
        dataPoints: prices.length,
        currentPrice: this.currentPrice,
      });
    } catch (error) {
      console.error('Error fetching data for selected crypto:', error);
    }
  }

  // Add method to create chart for selected crypto
  createChartForSelectedCrypto(prices: number[], labels: string[]) {
    if (this.chart) {
      this.chart.destroy();
    }

    if (!this.lineChart?.nativeElement) {
      console.error('Canvas element not found!');
      return;
    }

    const mintColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent-turquoise')
      .trim();

    this.chart = new Chart(this.lineChart.nativeElement, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: `${this.selectedCryptoName} Preis (USD)`,
            data: prices,
            borderColor: mintColor,
            backgroundColor: mintColor + '33',
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 6,
            borderWidth: 2,
            tension: 0.4,
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

  // Add method to get quantity for selected crypto
  getSelectedCryptoQuantity(): number {
    // Berechne die verfügbare Menge für die ausgewählte Kryptowährung aus dem Portfolio
    let totalQuantity = 0;

    // Verwende das neue Portfolio-System
    if (this.userInvestments && this.userInvestments.length > 0) {
      const selectedCryptoInvestments = this.userInvestments.filter(
        (inv) => inv.asset_symbol === this.selectedCryptoSymbol || inv.investments === this.selectedCryptoName
      );
      selectedCryptoInvestments.forEach((inv) => {
        // Verwende quantity aus dem neuen Portfolio-System
        totalQuantity += inv.quantity || inv.calculatedShares || 0;
      });
    }

    return totalQuantity;
  }

  // Add method to get asset name from symbol
  getAssetNameFromSymbol(symbol: string): string {
    const symbolMap: { [key: string]: string } = {
      'BTC-USD': 'Bitcoin',
      'ETH-USD': 'Ethereum',
      'SOL-USD': 'Solana',
      'DOGE-USD': 'Dogecoin',
      'BNB-USD': 'Binance Coin',
      'ADA-USD': 'Cardano',
      'XRP-USD': 'Ripple',
      'AVAX-USD': 'Avalanche',
      'DOT-USD': 'Polkadot',
      'MATIC-USD': 'Polygon'
    };
    
    return symbolMap[symbol] || symbol;
  }
}

