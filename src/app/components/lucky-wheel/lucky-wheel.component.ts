import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnInit,
  ViewChild,
  OnDestroy,
} from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { FirebaseAdminService } from '../../services/firebase-admin.service';
import { LuckyWheelService } from '../../services/lucky-wheel.service';
import { TradingService } from '../../services/trading.service';
import { environment } from '../../../environments/environment';

const COLORS = ['#27AE60', '#1ABC9C'];

interface Prize {
  id: number;
  name: string;
  percentage: number; // Prozentsatz des Vermögens
  type: 'euro' | 'btc';
  probability: number;
  color: string;
}

@Component({
  selector: 'app-lucky-wheel',
  templateUrl: './lucky-wheel.component.html',
  styleUrls: ['./lucky-wheel.component.scss'],
})
export class LuckyWheelComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() set options(values: string[]) {
    console.log('Values', values);
    this.sectors = values.map((opts, i) => {
      return {
        color: COLORS[i % COLORS.length],
        label: opts,
      };
    });

    console.log(this.sectors);
    if (this.wheel) {
      this.createWheel();
    }
  }

  @ViewChild('wheel') wheel!: ElementRef<HTMLCanvasElement>;
  @ViewChild('spin') spinButton!: ElementRef;
  colors = ['#27AE60', '#1ABC9C'];
  sectors: any[] = [];

  rand = (m: number, M: number) => Math.random() * (M - m) + m;
  tot: number = 0;
  ctx: any;
  dia: number = 0;
  rad: number = 0;
  PI: number = Math.PI;
  TAU: number = 2 * Math.PI;
  arc0: number = 0;

  winners = [];

  // Deaktiviere das Löschen von Optionen
  modeDelete = false;

  friction = 0.995; // 0.995=soft, 0.99=mid, 0.98=hard
  angVel = 0; // Angular velocity
  ang = 0; // Angle in radians
  lastSelection: number = 0;

  // Animation loop
  private animationId: number | null = null;
  private isAnimating = false;
  private lastFrameTime = 0;
  private readonly FRAME_RATE = 60; // Begrenze auf 60 FPS
  private readonly FRAME_INTERVAL = 1000 / 60; // ~16.67ms zwischen Frames

  // Original properties
  rotation = 0;
  isSpinning = false;
  canSpin = true;
  prizes: Prize[] = [];
  spinResult: Prize | null = null;
  resolvedPrizeValue: number = 0;
  userBalance: number = 0; // Store user balance for prize calculations

  // Daily Spin Logic
  lastSpinTime: Date | null = null;
  nextSpinTime: Date | null = null;
  timeUntilNextSpin: string = '';
  isSpinBlocked = false;
  private spinCheckInterval: any;
  private countdownInterval: any;

  constructor(
    private modalController: ModalController,
    private toastController: ToastController,
    private http: HttpClient,
    private firebaseService: FirebaseAdminService,
    private luckyWheelService: LuckyWheelService,
    private tradingService: TradingService
  ) {}

  ngOnInit() {
    // Prozentuale Gewinne basierend auf Vermögen
    this.prizes = [
      {
        id: 1,
        name: 'MEGA JACKPOT!',
        percentage: 50, // 50% des Vermögens
        type: 'euro',
        probability: 1, // Sehr selten
        color: '#3880ff',
      },
      {
        id: 2,
        name: 'Kleiner Gewinn',
        percentage: 2, // 2% des Vermögens
        type: 'euro',
        probability: 35, // Häufig
        color: '#2dd36f',
      },
      {
        id: 3,
        name: 'Mittlerer Gewinn',
        percentage: 8, // 8% des Vermögens
        type: 'euro',
        probability: 20, // Mittel
        color: '#3880ff',
      },
      {
        id: 4,
        name: 'Kleiner Bonus',
        percentage: 3, // 3% des Vermögens
        type: 'euro',
        probability: 25, // Häufig
        color: '#2dd36f',
      },
      {
        id: 5,
        name: 'Großer Gewinn',
        percentage: 15, // 15% des Vermögens
        type: 'euro',
        probability: 10, // Selten
        color: '#3880ff',
      },
      {
        id: 6,
        name: 'Bonus',
        percentage: 5, // 5% des Vermögens
        type: 'euro',
        probability: 15, // Mittel
        color: '#2dd36f',
      },
      {
        id: 7,
        name: 'Guter Gewinn',
        percentage: 10, // 10% des Vermögens
        type: 'euro',
        probability: 12, // Selten
        color: '#3880ff',
      },
      {
        id: 8,
        name: 'Kleiner Gewinn',
        percentage: 4, // 4% des Vermögens
        type: 'euro',
        probability: 22, // Häufig
        color: '#2dd36f',
      },
    ];

    // Lade aktuelles Vermögen und initialisiere Sektoren
    this.loadCurrentBalanceAndUpdateWheel();

    console.log('Sektoren initialisiert:', this.sectors.length);

    // Prüfe Daily Spin Verfügbarkeit
    this.checkDailySpinAvailability();

    // Starte Timer für Spin-Verfügbarkeit
    this.startSpinCheckTimer();
  }

  ngAfterViewInit(): void {
    // Warte kurz bis DOM vollständig geladen ist
    setTimeout(() => {
      // Starte Animation-Loop nur wenn Sektoren verfügbar sind
      if (this.sectors.length > 0) {
        this.startAnimationLoop();
      }
    }, 100);
  }

  ngOnDestroy(): void {
    this.stopAnimationLoop();
    if (this.spinCheckInterval) {
      clearInterval(this.spinCheckInterval);
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  private startAnimationLoop(): void {
    if (this.isAnimating) return;

    this.isAnimating = true;
    this.lastFrameTime = performance.now();

    const animate = (currentTime: number) => {
      if (!this.isAnimating) return;

      // Frame Rate Limiting
      const deltaTime = currentTime - this.lastFrameTime;
      if (deltaTime >= this.FRAME_INTERVAL) {
        this.frame();
        this.lastFrameTime = currentTime;
      }

      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);
    console.log('Animation-Loop gestartet');
  }

  private stopAnimationLoop(): void {
    this.isAnimating = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  createWheel() {
    if (!this.wheel || this.sectors.length === 0) {
      console.warn('Wheel oder Sektoren nicht verfügbar');
      return;
    }

    try {
      this.ctx = this.wheel.nativeElement.getContext('2d');
      this.dia = this.ctx.canvas.width;
      this.tot = this.sectors.length;
      this.rad = this.dia / 2;
      this.PI = Math.PI;
      this.TAU = 2 * this.PI;

      this.arc0 = this.TAU / this.sectors.length;

      // Lösche Canvas vor dem Zeichnen
      this.ctx.clearRect(0, 0, this.dia, this.dia);

      this.sectors.forEach((sector, i) => this.drawSector(sector, i));
      this.rotate(true);

      console.log(
        'Wheel erfolgreich erstellt mit',
        this.sectors.length,
        'Sektoren'
      );
    } catch (error) {
      console.error('Fehler beim Erstellen des Wheels:', error);
    }
  }

  spinner() {
    // Prüfe Daily Spin Verfügbarkeit
    if (this.isSpinBlocked) {
      this.showToast(
        'Bitte warten Sie noch ' +
          this.timeUntilNextSpin +
          ' bis zum nächsten Spin.',
        'medium'
      );
      return;
    }

    if (!this.angVel && this.canSpin && !this.isSpinning) {
      this.isSpinning = true;
      this.angVel = this.rand(0.25, 0.35);

      // Starte Animation nur wenn sie nicht läuft
      if (!this.isAnimating) {
        this.startAnimationLoop();
      }
    }
  }

  getIndex = () =>
    Math.floor(this.tot - (this.ang / this.TAU) * this.tot) % this.tot;

  drawSector(sector: any, i: number) {
    const ang = this.arc0 * i;
    this.ctx.save();
    // COLOR
    this.ctx.beginPath();
    this.ctx.fillStyle = sector.color;
    this.ctx.moveTo(this.rad, this.rad);

    this.ctx.arc(this.rad, this.rad, this.rad, ang, ang + this.arc0);
    this.ctx.lineTo(this.rad, this.rad);
    this.ctx.fill();
    // TEXT
    this.ctx.translate(this.rad, this.rad);
    this.ctx.rotate(ang + this.arc0 / 2);
    this.ctx.textAlign = 'right';
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 30px sans-serif';
    this.ctx.fillText(sector.label, this.rad - 10, 10);
    //
    this.ctx.restore();
  }

  rotate(first = false) {
    if (!this.ctx || !this.spinButton) return;

    const sector = this.sectors[this.getIndex()];
    this.ctx.canvas.style.transform = `rotate(${this.ang - this.PI / 2}rad)`;
    this.spinButton.nativeElement.textContent = !this.angVel
      ? 'SPIN'
      : sector.label;
    if (!first) {
      this.lastSelection = !this.angVel ? this.lastSelection : this.getIndex();
      if (!this.angVel && this.isSpinning) {
        this.handleSpinResult();
      }
    }
    this.spinButton.nativeElement.style.background = sector.color;
  }

  frame() {
    if (!this.angVel) return;

    this.angVel *= this.friction; // Decrement velocity by friction
    if (this.angVel < 0.002) {
      this.angVel = 0; // Bring to stop
      // Stoppe Animation nur wenn Rad stillsteht UND nicht mehr spinnend
      if (!this.isSpinning) {
        console.log('Animation gestoppt - Rad steht still');
        this.stopAnimationLoop();
      }
    }
    this.ang += this.angVel; // Update angle
    this.ang %= this.TAU; // Normalize angle
    this.rotate();
  }

  handleSpinResult() {
    this.isSpinning = false;
    const selectedSector = this.sectors[this.lastSelection];
    const selectedPrize = selectedSector.prize;

    if (selectedPrize) {
      // Speichere den Gewinn in der Datenbank
      this.saveSpinResult(selectedPrize);

      // Zeige das Ergebnis an
      this.showResult(selectedPrize);

      // Zeige Ergebnis
      this.spinResult = selectedPrize;

      // Blockiere Spin für 24h
      this.isSpinBlocked = true;
      this.canSpin = false;
      this.lastSpinTime = new Date();
      this.nextSpinTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h von jetzt
      this.updateTimeUntilNextSpin();
    } else {
      this.showToast('Fehler beim Verarbeiten des Gewinns', 'danger');
    }
  }

  // Original spin method for compatibility
  spin() {
    if (this.isSpinning || !this.canSpin) return;
    this.spinner();
  }

  saveSpinResult(prize: Prize) {
    // Lade Benutzer aus Firebase Service
    try {
      const currentUser = this.firebaseService.getCurrentUser();
      if (currentUser) {

        // Verwende Firestore-basierte Logik (Spark-kompatibel)
        this.luckyWheelService.spinWheel(currentUser.id, prize.percentage).subscribe({
          next: (response: any) => {
            if (response.success) {
              console.log('Gewinn erfolgreich gespeichert:', response);
              this.showToast(`Gewinn erfolgreich hinzugefügt! ${response.prizeAmount}€`, 'success');

              // Aktualisiere das Benutzer-Vermögen im localStorage und im Service
              if (currentUser) {
                const userData = {
                  ...currentUser,
                  balance: response.newBalance
                };
                localStorage.setItem('currentUser', JSON.stringify(userData));
                // Optional: FirebaseAdminService aktualisieren, falls vorhanden
                (this.firebaseService as any).currentUser = userData;
              }
            } else {
              console.error(
                'Fehler beim Speichern des Gewinns:',
                response.message
              );
              this.showToast(
                'Fehler beim Speichern des Gewinns: ' + response.message,
                'danger'
              );
            }
          },
          error: (error) => {
            console.error('Fehler beim Speichern des Spins:', error);
            this.showToast('Fehler beim Speichern des Gewinns', 'danger');
          },
        });
      } else {
        console.warn('Kein Benutzer gefunden, Gewinn wird nicht gespeichert');
        this.showToast(
          'Kein Benutzer gefunden - Gewinn wird nicht gespeichert',
          'warning'
        );
      }
    } catch (error) {
      console.error('Fehler beim Laden des Benutzers:', error);
      this.showToast('Fehler beim Laden des Benutzers', 'danger');
    }
  }

  async showResult(prize: Prize) {
    // Berechne den tatsächlichen Gewinnwert basierend auf dem Gesamtvermögen
    const actualPrizeValue = await this.getActualPrizeValue(prize);

    // Store the resolved value for use in the template
    this.resolvedPrizeValue = actualPrizeValue;

    let message = `Glückwunsch! Sie haben ${prize.name} gewonnen!`;

    if (prize.type === 'euro') {
      message += ` ${actualPrizeValue}€ wurden Ihrem Konto gutgeschrieben!`;
    } else if (prize.type === 'btc') {
      message += ` ${actualPrizeValue} BTC wurden Ihrem Portfolio hinzugefügt!`;
    }

    this.showToast(message, 'success');
  }

  showToast(message: string, color: string) {
    this.toastController
      .create({
        message,
        duration: 3000,
        color,
        position: 'top',
      })
      .then((toast) => toast.present());
  }

  dismiss() {
    this.modalController.dismiss();
  }

  // Get total assets including balance and investments
  async getTotalAssets(): Promise<number> {
    try {
      const user = this.firebaseService.getCurrentUser();
      if (!user) return 0;

      // Return a promise that resolves with the total assets value
      return new Promise((resolve) => {
        this.tradingService.getPortfolio(user.id).subscribe({
          next: (response) => {
            if (response.success) {
              let assetsCurrentValue = 0;

              // Calculate value of all assets
              if (response.assets && response.assets.length > 0) {
                response.assets.forEach((asset: any) => {
                  const currentValue = asset.quantity * (asset.currentPrice || 0);
                  assetsCurrentValue += currentValue;
                });
              }

              // Get cash balance
              const cashBalance = response.cashBalance ?? user.balance ?? 0;

              // Total assets = cash + investments
              const totalAssets = cashBalance + assetsCurrentValue;
              console.log('Total assets calculated:', totalAssets);
              resolve(totalAssets);
            } else {
              console.error('Portfolio response not successful:', response);
              resolve(user.balance || 0); // Fallback to balance
            }
          },
          error: (error) => {
            console.error('Error fetching portfolio:', error);
            resolve(user.balance || 0); // Fallback to balance
          }
        });
      });
    } catch (error) {
      console.error('Error calculating total assets:', error);
      return 0;
    }
  }

  async getActualPrizeValue(prize: Prize): Promise<number> {
    const totalAssets = await this.getTotalAssets();

    // Calculate prize based on total assets
    let prizeValue = Math.round((totalAssets * prize.percentage) / 100);

    return prizeValue;
  }

  // Non-async version for use in templates with pipes
  getActualPrizeValueSync(prize: Prize | null): number {
    if (!prize) return 0;
    return this.resolvedPrizeValue;
  }

  // Format prize label with actual value based on user's total assets
  async formatPrizeLabel(prize: Prize, balance: number = 0): Promise<string> {
    // Use total assets (balance + investments) for consistency with getActualPrizeValue
    const totalAssets = await this.getTotalAssets();

    // Calculate actual value based on total assets and prize percentage
    const prizeValue = Math.round((totalAssets * prize.percentage) / 100);

    if (prizeValue >= 1000000) {
      return `${(prizeValue / 1000000).toFixed(1)}Mil`;
    } else if (prizeValue >= 1000) {
      return `${(prizeValue / 1000).toFixed(1)}K`;
    } else {
      return `${prizeValue}€`;
    }
  }

  // Synchronous version for use in templates
  formatPrizeLabelSync(prize: Prize): string {
    // Use the stored balance as a fallback
    const prizeValue = Math.round((this.userBalance * prize.percentage) / 100);

    if (prizeValue >= 1000000) {
      return `${(prizeValue / 1000000).toFixed(1)}Mil`;
    } else if (prizeValue >= 1000) {
      return `${(prizeValue / 1000).toFixed(1)}K`;
    } else {
      return `${prizeValue}€`;
    }
  }

  loadCurrentBalanceAndUpdateWheel() {
    try {
      const currentUser = this.firebaseService.getCurrentUser();
      if (currentUser) {

        // Lade aktuelles Vermögen clientseitig
        this.tradingService.getBalance(currentUser.id).subscribe({
          next: (response: any) => {
            if (response.success) {
              // Store the balance for prize calculations
              this.userBalance = response.balance;

              // Aktualisiere das Vermögen im localStorage für Kompatibilität
              const userData = {
                ...currentUser,
                balance: response.balance
              };
              localStorage.setItem(
                'currentUser',
                JSON.stringify(userData)
              );

              // Aktualisiere die Sektoren mit dem aktuellen Vermögen
              this.updateWheelLabels().catch(err => {
                console.error('Error updating wheel labels:', err);
              });
              console.log('Vermögen geladen:', response.balance);
            } else {
              console.error(
                'Fehler beim Laden des Vermögens:',
                response.message
              );
              // Fallback auf localStorage oder Standardwert
              this.userBalance = currentUser.balance || 0;
              this.updateWheelLabels().catch(err => {
                console.error('Error updating wheel labels:', err);
              });
            }
          },
          error: (error) => {
            console.error('Fehler beim Laden des Vermögens:', error);
            // Fallback auf localStorage oder Standardwert
            this.userBalance = currentUser.balance || 0;
            this.updateWheelLabels().catch(err => {
              console.error('Error updating wheel labels:', err);
            });
          },
        });
      } else {
        // Kein Benutzer gefunden, verwende Standardwert
        this.userBalance = 0;
        this.updateWheelLabels().catch(err => {
          console.error('Error updating wheel labels:', err);
        });
      }
    } catch (error) {
      console.error('Fehler beim Laden des Benutzers:', error);
      this.userBalance = 0;
      this.updateWheelLabels().catch(err => {
        console.error('Error updating wheel labels:', err);
      });
    }
  }

  async updateWheelLabels() {
    try {
      // First, create sectors with synchronous labels
      this.sectors = this.prizes.map((prize, i) => {
        return {
          color: COLORS[i % COLORS.length],
          label: this.formatPrizeLabelSync(prize), // Use sync version initially
          prize: prize,
        };
      });

      // Draw the wheel with initial labels
      if (this.wheel) {
        this.createWheel();
      }

      // Then update with accurate async labels
      const labelPromises = this.prizes.map(prize => this.formatPrizeLabel(prize, this.userBalance));
      const labels = await Promise.all(labelPromises);

      // Update sectors with accurate labels
      this.sectors = this.prizes.map((prize, i) => {
        return {
          color: COLORS[i % COLORS.length],
          label: labels[i],
          prize: prize,
        };
      });

      // Redraw the wheel with accurate labels
      if (this.wheel) {
        this.createWheel();
      }

      console.log('Wheel labels updated with actual prize values');
    } catch (error) {
      console.error('Error updating wheel labels:', error);
      // Fallback to sync labels if async fails
      this.sectors = this.prizes.map((prize, i) => {
        return {
          color: COLORS[i % COLORS.length],
          label: this.formatPrizeLabelSync(prize),
          prize: prize,
        };
      });

      if (this.wheel) {
        this.createWheel();
      }
    }
  }

  // Daily Spin Logic
  private checkDailySpinAvailability() {
    try {
      const currentUser = this.firebaseService.getCurrentUser();
      if (currentUser) {
        // Prüfe mit Firestore, ob heute schon gedreht wurde
        this.luckyWheelService.checkLastSpin(currentUser.id).subscribe(({ canSpin }) => {
          this.isSpinBlocked = !canSpin;
          this.canSpin = canSpin;
          this.lastSpinTime = null;
          this.nextSpinTime = canSpin ? null : new Date(Date.now() + 24 * 60 * 60 * 1000);
          this.timeUntilNextSpin = '';
        });
      } else {
        console.warn('Kein Benutzer gefunden');
        this.showToast('Bitte melden Sie sich an', 'warning');
      }
    } catch (error) {
      console.error('Fehler beim Laden des Benutzers:', error);
      this.showToast('Fehler beim Laden des Benutzers', 'danger');
    }
  }

  private startSpinCheckTimer() {
    // Starte live Countdown Timer (jede Sekunde)
    this.countdownInterval = setInterval(() => {
      if (this.isSpinBlocked) {
        this.updateTimeUntilNextSpin();
      }
    }, 1000); // Jede Sekunde

    // Prüfe Spin-Verfügbarkeit alle 30 Sekunden
    this.spinCheckInterval = setInterval(() => {
      if (this.isSpinBlocked) {
        // Prüfe ob 24h vergangen sind
        if (this.nextSpinTime && new Date() >= this.nextSpinTime) {
          this.checkDailySpinAvailability();
        }
      }
    }, 30000); // 30 Sekunden
  }

  private updateTimeUntilNextSpin() {
    if (this.nextSpinTime) {
      const now = new Date();
      const timeDiff = this.nextSpinTime.getTime() - now.getTime();

      if (timeDiff <= 0) {
        this.timeUntilNextSpin = 'Jetzt verfügbar!';
        this.isSpinBlocked = false;
        this.canSpin = true;
      } else {
        const hours = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

        this.timeUntilNextSpin = `${hours.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }
  }
}
