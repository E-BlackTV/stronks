import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TradingService, TradeRequest } from '../../services/trading.service';
import { AuthenticationService } from '../../services/authentication.service';
import { Subscription, timer } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-trade-popup',
  templateUrl: './trade-popup.component.html',
  styleUrls: ['./trade-popup.component.scss'],
})
export class TradePopupComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Input() action: 'buy' | 'sell' = 'buy';
  @Input() assetSymbol = '';
  @Input() assetName = '';
  @Input() currentPrice = 0;
  @Input() userBalance = 0;
  @Input() availableQuantity = 0; // Für Verkauf
  @Output() close = new EventEmitter<void>();
  @Output() tradeCompleted = new EventEmitter<any>();

  // Input-Change-Handler für Preis-Updates
  ngOnChanges(changes: any) {
    // Nur reagieren wenn sich wichtige Werte ändern
    if (
      changes.currentPrice &&
      changes.currentPrice.currentValue !==
        changes.currentPrice.previousValue &&
      changes.currentPrice.currentValue > 0
    ) {
      // Preis hat sich geändert - Berechnungen aktualisieren
      this.calculateMaxAmount();
      this.updateCalculations();
    }

    // Nur bei der ersten Initialisierung oder wenn sich action ändert
    if (
      (changes.action &&
        changes.action.currentValue !== changes.action.previousValue) ||
      (changes.userBalance &&
        changes.userBalance.currentValue !==
          changes.userBalance.previousValue &&
        changes.userBalance.currentValue > 0) ||
      (changes.availableQuantity &&
        changes.availableQuantity.currentValue !==
          changes.availableQuantity.previousValue &&
        changes.availableQuantity.currentValue > 0)
    ) {
      // Verzögerung um sicherzustellen, dass alle Inputs gesetzt sind
      setTimeout(() => {
        this.calculateMaxAmount();
        this.updateCalculations();
      }, 100);
    }
  }

  tradeForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  // Live-Updates
  dollarAmount = 0;
  assetQuantity = 0;
  percentage = 0;
  maxAmount = 0;

  private priceUpdateSubscription: Subscription = new Subscription();
  private formSubscription: Subscription = new Subscription();

  constructor(
    private fb: FormBuilder,
    private tradingService: TradingService,
    private authService: AuthenticationService,
    private http: HttpClient
  ) {
    this.tradeForm = this.fb.group({
      euroAmount: [0, [Validators.min(0)]], // Feldname bleibt für Kompatibilität
      assetQuantity: [0, [Validators.min(0)]],
      percentage: [0, [Validators.min(0), Validators.max(100)]],
    });
  }

  ngOnInit() {
    this.setupForm();
    this.startPriceUpdates();

    // Initialisierung nur wenn alle Werte verfügbar sind
    if (this.currentPrice > 0 && this.userBalance > 0) {
      this.calculateMaxAmount();
      this.updateCalculations();
    }
  }

  ngOnDestroy() {
    if (this.priceUpdateSubscription) {
      this.priceUpdateSubscription.unsubscribe();
    }
    if (this.formSubscription) {
      this.formSubscription.unsubscribe();
    }
  }

  private setupForm() {
    this.tradeForm = this.fb.group({
      euroAmount: [0, [Validators.required, Validators.min(0)]],
      assetQuantity: [0, [Validators.required, Validators.min(0)]],
      percentage: [
        0,
        [Validators.required, Validators.min(0), Validators.max(100)],
      ],
    });

    // Live-Updates für Dollar-Betrag (Feldname bleibt euroAmount für Kompatibilität)
    const dollarSubscription = this.tradeForm
      .get('euroAmount')
      ?.valueChanges.pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((value) => {
        if (value && this.currentPrice > 0) {
          // Validierung: Verhindere Eingabe von mehr Geld als verfügbar
          if (this.action === 'buy' && value > this.userBalance) {
            this.dollarAmount = Math.round(this.userBalance * 100) / 100;
            this.tradeForm.patchValue(
              { euroAmount: this.dollarAmount },
              { emitEvent: false }
            );
            this.errorMessage = `Maximal ${this.userBalance.toFixed(
              2
            )} $ verfügbar`;
            setTimeout(() => (this.errorMessage = ''), 3000);
          } else if (
            this.action === 'sell' &&
            value > this.availableQuantity * this.currentPrice
          ) {
            this.dollarAmount =
              Math.round(this.availableQuantity * this.currentPrice * 100) /
              100;
            this.tradeForm.patchValue(
              { euroAmount: this.dollarAmount },
              { emitEvent: false }
            );
            this.errorMessage = `Maximal ${(
              this.availableQuantity * this.currentPrice
            ).toFixed(2)} $ verfügbar`;
            setTimeout(() => (this.errorMessage = ''), 3000);
          } else {
            this.dollarAmount = Math.round(value * 100) / 100;
            this.errorMessage = '';
          }

          this.assetQuantity =
            Math.round((this.dollarAmount / this.currentPrice) * 100000000) /
            100000000;
          this.percentage =
            Math.round(
              (this.action === 'buy'
                ? (this.dollarAmount / this.userBalance) * 100
                : (this.dollarAmount /
                    (this.availableQuantity * this.currentPrice)) *
                  100) * 10
            ) / 10;

          this.tradeForm.patchValue(
            {
              assetQuantity: this.assetQuantity,
              percentage: this.percentage,
            },
            { emitEvent: false }
          );
        }
      });

    if (dollarSubscription) {
      this.formSubscription.add(dollarSubscription);
    }

    // Live-Updates für Asset-Menge
    const assetSubscription = this.tradeForm
      .get('assetQuantity')
      ?.valueChanges.pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((value) => {
        if (value && this.currentPrice > 0) {
          this.assetQuantity = Math.round(value * 100000000) / 100000000;
          this.dollarAmount =
            Math.round(this.assetQuantity * this.currentPrice * 100) / 100;

          // Validierung basierend auf Aktion
          if (this.action === 'buy') {
            if (this.dollarAmount > this.userBalance) {
              this.dollarAmount = Math.round(this.userBalance * 100) / 100;
              this.assetQuantity =
                Math.round((this.userBalance / this.currentPrice) * 100000000) /
                100000000;
              this.tradeForm.patchValue(
                {
                  euroAmount: this.dollarAmount,
                  assetQuantity: this.assetQuantity,
                },
                { emitEvent: false }
              );
              this.errorMessage = `Maximal ${this.userBalance.toLocaleString(
                'de-DE',
                {
                  style: 'currency',
                  currency: 'USD',
                }
              )} $ verfügbar`;
              setTimeout(() => (this.errorMessage = ''), 3000);
            } else {
              this.errorMessage = '';
            }
          } else if (this.action === 'sell') {
            // Beim Verkaufen nur BTC-Menge prüfen, KEINE Dollar-Validierung
            if (this.assetQuantity > this.availableQuantity) {
              this.assetQuantity =
                Math.round(this.availableQuantity * 100000000) / 100000000;
              this.dollarAmount =
                Math.round(this.availableQuantity * this.currentPrice * 100) /
                100;
              this.tradeForm.patchValue(
                {
                  assetQuantity: this.assetQuantity,
                  euroAmount: this.dollarAmount,
                },
                { emitEvent: false }
              );
              this.errorMessage = `Maximal ${this.availableQuantity.toFixed(
                8
              )} BTC verfügbar`;
              setTimeout(() => (this.errorMessage = ''), 3000);
            } else {
              this.errorMessage = '';
            }
          }

          this.percentage =
            Math.round(
              (this.action === 'buy'
                ? (this.dollarAmount / this.userBalance) * 100
                : (this.dollarAmount /
                    (this.availableQuantity * this.currentPrice)) *
                  100) * 10
            ) / 10;

          this.tradeForm.patchValue(
            {
              euroAmount: this.dollarAmount,
              percentage: this.percentage,
            },
            { emitEvent: false }
          );
        }
      });

    if (assetSubscription) {
      this.formSubscription.add(assetSubscription);
    }

    // Live-Updates für Prozentsatz
    const percentageSubscription = this.tradeForm
      .get('percentage')
      ?.valueChanges.pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((value) => {
        if (value >= 0 && value <= 100) {
          this.percentage = Math.round(value * 10) / 10;
          if (this.action === 'buy') {
            this.dollarAmount =
              Math.round(((this.userBalance * value) / 100) * 100) / 100;
            this.assetQuantity =
              Math.round((this.dollarAmount / this.currentPrice) * 100000000) /
              100000000;
          } else {
            this.dollarAmount =
              Math.round(
                ((this.availableQuantity * this.currentPrice * value) / 100) *
                  100
              ) / 100;
            this.assetQuantity =
              Math.round(((this.availableQuantity * value) / 100) * 100000000) /
              100000000;
          }

          this.tradeForm.patchValue(
            {
              euroAmount: this.dollarAmount,
              assetQuantity: this.assetQuantity,
            },
            { emitEvent: false }
          );
        }
      });

    if (percentageSubscription) {
      this.formSubscription.add(percentageSubscription);
    }
  }

  private calculateMaxAmount() {
    if (this.action === 'buy') {
      this.maxAmount = this.userBalance;
      this.dollarAmount = Math.round(this.userBalance * 100) / 100;
      this.assetQuantity =
        this.currentPrice > 0
          ? Math.round((this.userBalance / this.currentPrice) * 100000000) /
            100000000
          : 0;
    } else if (this.action === 'sell') {
      this.maxAmount = this.availableQuantity * this.currentPrice;
      // Beim Verkaufen: Alle verfügbaren Assets
      this.assetQuantity =
        Math.round(this.availableQuantity * 100000000) / 100000000;
      this.dollarAmount =
        Math.round(this.assetQuantity * this.currentPrice * 100) / 100;
    }

    this.percentage =
      this.action === 'buy'
        ? Math.round((this.dollarAmount / this.userBalance) * 1000) / 10
        : Math.round((this.assetQuantity / this.availableQuantity) * 1000) / 10;

    this.tradeForm.patchValue(
      {
        euroAmount: this.dollarAmount,
        assetQuantity: this.assetQuantity,
        percentage: this.percentage,
      },
      { emitEvent: false }
    );
  }

  private startPriceUpdates() {
    // Keine automatischen Preis-Updates mehr, da das Popup die echten Daten von der Home-Seite bekommt
    // Der Preis wird über @Input() currentPrice von der Home-Seite übergeben
  }

  private updateCalculations() {
    if (this.dollarAmount > 0) {
      // Validierung: Verhindere Überschreitung des verfügbaren Betrags
      if (this.action === 'buy' && this.dollarAmount > this.userBalance) {
        this.dollarAmount = Math.round(this.userBalance * 100) / 100;
        this.assetQuantity =
          this.currentPrice > 0
            ? Math.round((this.dollarAmount / this.currentPrice) * 100000000) /
              100000000
            : 0;
        this.percentage =
          Math.round((this.dollarAmount / this.userBalance) * 100 * 10) / 10;
        this.tradeForm.patchValue(
          {
            euroAmount: this.dollarAmount,
            assetQuantity: this.assetQuantity,
            percentage: this.percentage,
          },
          { emitEvent: false }
        );
        this.errorMessage = `Maximal ${this.userBalance.toFixed(
          2
        )} $ verfügbar`;
        setTimeout(() => (this.errorMessage = ''), 3000);
      } else {
        this.assetQuantity =
          this.currentPrice > 0
            ? Math.round((this.dollarAmount / this.currentPrice) * 100000000) /
              100000000
            : 0;
        this.percentage =
          Math.round(
            (this.action === 'buy'
              ? (this.dollarAmount / this.userBalance) * 100
              : (this.dollarAmount /
                  (this.availableQuantity * this.currentPrice)) *
                100) * 10
          ) / 10;
      }
    } else if (this.assetQuantity > 0) {
      this.dollarAmount =
        Math.round(this.assetQuantity * this.currentPrice * 100) / 100;

      // Validierung: Verhindere Überschreitung des verfügbaren Betrags
      if (this.action === 'buy' && this.dollarAmount > this.userBalance) {
        this.assetQuantity =
          this.currentPrice > 0
            ? Math.round((this.userBalance / this.currentPrice) * 100000000) /
              100000000
            : 0;
        this.dollarAmount = Math.round(this.userBalance * 100) / 100;
        this.percentage =
          Math.round((this.dollarAmount / this.userBalance) * 100 * 10) / 10;
        this.tradeForm.patchValue(
          {
            euroAmount: this.dollarAmount,
            assetQuantity: this.assetQuantity,
            percentage: this.percentage,
          },
          { emitEvent: false }
        );
        this.errorMessage = `Maximal ${this.userBalance.toFixed(
          2
        )} $ verfügbar`;
        setTimeout(() => (this.errorMessage = ''), 3000);
      } else {
        this.percentage =
          Math.round(
            (this.action === 'buy'
              ? (this.dollarAmount / this.userBalance) * 100
              : (this.dollarAmount /
                  (this.availableQuantity * this.currentPrice)) *
                100) * 10
          ) / 10;
      }
    }
  }

  setMaxAmount() {
    this.percentage = 100;

    if (this.action === 'buy') {
      this.dollarAmount = Math.round(this.userBalance * 100) / 100;
      this.assetQuantity =
        this.currentPrice > 0
          ? Math.round((this.dollarAmount / this.currentPrice) * 100000000) /
            100000000
          : 0;
    } else {
      // Beim Verkauf: Alle verfügbaren Assets
      this.assetQuantity =
        Math.round(this.availableQuantity * 100000000) / 100000000;
      this.dollarAmount =
        Math.round(this.assetQuantity * this.currentPrice * 100) / 100;
    }

    this.tradeForm.patchValue(
      {
        percentage: 100,
        euroAmount: this.dollarAmount,
        assetQuantity: this.assetQuantity,
      },
      { emitEvent: false }
    );

    this.errorMessage = '';
  }

  setHalfAmount() {
    this.percentage = 50;

    if (this.action === 'buy') {
      this.dollarAmount = Math.round(this.userBalance * 0.5 * 100) / 100;
      this.assetQuantity =
        this.currentPrice > 0
          ? Math.round((this.dollarAmount / this.currentPrice) * 100000000) /
            100000000
          : 0;
    } else {
      // Beim Verkauf: 50% der verfügbaren Assets
      this.assetQuantity =
        Math.round(this.availableQuantity * 0.5 * 100000000) / 100000000;
      this.dollarAmount =
        Math.round(this.assetQuantity * this.currentPrice * 100) / 100;
    }

    this.tradeForm.patchValue(
      {
        percentage: 50,
        euroAmount: this.dollarAmount,
        assetQuantity: this.assetQuantity,
      },
      { emitEvent: false }
    );

    this.errorMessage = '';
  }

  setQuarterAmount() {
    this.percentage = 25;

    if (this.action === 'buy') {
      this.dollarAmount = Math.round(this.userBalance * 0.25 * 100) / 100;
      this.assetQuantity =
        this.currentPrice > 0
          ? Math.round((this.dollarAmount / this.currentPrice) * 100000000) /
            100000000
          : 0;
    } else {
      // Beim Verkauf: 25% der verfügbaren Assets
      this.assetQuantity =
        Math.round(this.availableQuantity * 0.25 * 100000000) / 100000000;
      this.dollarAmount =
        Math.round(this.assetQuantity * this.currentPrice * 100) / 100;
    }

    this.tradeForm.patchValue(
      {
        percentage: 25,
        euroAmount: this.dollarAmount,
        assetQuantity: this.assetQuantity,
      },
      { emitEvent: false }
    );

    this.errorMessage = '';
  }

  async executeTrade() {
    if (this.tradeForm.invalid) {
      this.errorMessage = 'Bitte fülle alle Felder korrekt aus';
      return;
    }

    const formValue = this.tradeForm.value;

    // Finale Validierung vor dem Trade
    if (this.action === 'buy' && formValue.euroAmount > this.userBalance) {
      this.errorMessage = `Nicht genügend Guthaben verfügbar. Maximal ${this.userBalance.toLocaleString(
        'de-DE',
        {
          style: 'currency',
          currency: 'USD',
        }
      )}`;
      return;
    }

    if (
      this.action === 'sell' &&
      formValue.assetQuantity > this.availableQuantity
    ) {
      this.errorMessage = `Nicht genügend ${
        this.assetSymbol.split('-')[0]
      } verfügbar. Maximal ${this.availableQuantity.toFixed(8)}`;
      return;
    }

    // Prüfe auf Rundungsfehler beim Verkauf
    if (
      this.action === 'sell' &&
      Math.abs(formValue.assetQuantity - this.availableQuantity) < 0.00000001
    ) {
      // Wenn die Menge fast gleich der verfügbaren Menge ist, erlaube den Verkauf
      console.log('Allowing sell of all available assets (rounding tolerance)');
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      const userId = this.authService.getCurrentUser()?.id;
      if (!userId) {
        this.errorMessage = 'Benutzer nicht angemeldet';
        this.isLoading = false;
        return;
      }

      if (this.action === 'buy') {
        // Kauf-Request an buy.php senden
        const buyRequest = {
          user_id: userId,
          asset_symbol: this.assetSymbol,
          quantity: formValue.assetQuantity,
          amount: formValue.euroAmount,
          current_price: this.currentPrice,
        };

        console.log('Sending buy request:', buyRequest);

        this.http.post('/backend/buy.php', buyRequest).subscribe({
          next: (response: any) => {
            console.log('Buy response:', response);
            if (response.success) {
              this.successMessage = 'Kauf erfolgreich!';
              this.tradeCompleted.emit(response);
              setTimeout(() => {
                this.closePopup();
              }, 1500);
            } else {
              this.errorMessage = response.message || 'Kauf fehlgeschlagen';
              this.isLoading = false;
            }
          },
          error: (error) => {
            console.error('Buy error:', error);
            this.errorMessage = 'Fehler beim Ausführen des Kaufs';
            this.isLoading = false;
          },
        });
      } else {
        // Verkauf-Request an sellInvestment.php senden
        // Für den Verkauf brauchen wir die Portfolio-ID
        this.tradingService.getPortfolio(userId).subscribe({
          next: (portfolioResponse) => {
            if (portfolioResponse.success) {
              const portfolioItem = portfolioResponse.portfolio.find(
                (item) => item.asset_symbol === this.assetSymbol
              );

              if (portfolioItem) {
                const sellRequest = {
                  user_id: userId,
                  portfolio_id: portfolioItem.id,
                  sell_percentage: formValue.percentage,
                };

                console.log('Sending sell request:', sellRequest);

                this.http
                  .post('/backend/sellInvestment.php', sellRequest)
                  .subscribe({
                    next: (response: any) => {
                      console.log('Sell response:', response);
                      if (response.success) {
                        this.successMessage = 'Verkauf erfolgreich!';
                        this.tradeCompleted.emit(response);
                        setTimeout(() => {
                          this.closePopup();
                        }, 1500);
                      } else {
                        this.errorMessage =
                          response.message || 'Verkauf fehlgeschlagen';
                        this.isLoading = false;
                      }
                    },
                    error: (error) => {
                      console.error('Sell error:', error);
                      this.errorMessage = 'Fehler beim Ausführen des Verkaufs';
                      this.isLoading = false;
                    },
                  });
              } else {
                this.errorMessage = 'Portfolio-Position nicht gefunden';
                this.isLoading = false;
              }
            } else {
              this.errorMessage = 'Fehler beim Laden des Portfolios';
              this.isLoading = false;
            }
          },
          error: (error) => {
            console.error('Portfolio error:', error);
            this.errorMessage = 'Fehler beim Laden des Portfolios';
            this.isLoading = false;
          },
        });
      }
    } catch (error) {
      console.error('Trade execution error:', error);
      this.errorMessage = 'Unerwarteter Fehler';
      this.isLoading = false;
    }
  }

  closePopup() {
    this.isOpen = false;
    this.tradeForm.reset();
    this.errorMessage = '';
    this.successMessage = '';
    this.close.emit();
  }

  getPercentageColor(): string {
    if (this.percentage <= 25) return '#4CAF50';
    if (this.percentage <= 50) return '#FF9800';
    if (this.percentage <= 75) return '#FF5722';
    return '#F44336';
  }

  getActionText(): string {
    return this.action === 'buy' ? 'Kaufen' : 'Verkaufen';
  }

  getActionColor(): string {
    return this.action === 'buy' ? '#4CAF50' : '#F44336';
  }
}
