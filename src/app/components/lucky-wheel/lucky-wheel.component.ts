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
    private http: HttpClient
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
    // Lade Benutzer aus localStorage für die Datenbank
    try {
      const userData = localStorage.getItem('currentUser');
      if (userData) {
        const currentUser = JSON.parse(userData);

        // Berechne den tatsächlichen Gewinn basierend auf dem aktuellen Vermögen
        const currentBalance = currentUser.balance || 10000; // Fallback auf 10000
        const actualPrizeValue = Math.round(
          (currentBalance * prize.percentage) / 100
        );

        this.http
          .post(`${environment.apiUrl}/lucky-wheel.php?action=spin_wheel`, {
            user_id: currentUser.id,
            prize_value: actualPrizeValue,
          })
          .subscribe({
            next: (response: any) => {
              if (response.success) {
                console.log('Gewinn erfolgreich gespeichert:', response);
                this.showToast('Gewinn erfolgreich hinzugefügt!', 'success');
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

  showResult(prize: Prize) {
    // Lade aktuelles Vermögen für die Berechnung
    const userData = localStorage.getItem('currentUser');
    const currentUser = userData ? JSON.parse(userData) : null;
    const currentBalance = currentUser?.balance || 10000;
    const actualPrizeValue = Math.round(
      (currentBalance * prize.percentage) / 100
    );

    let message = `Glückwunsch! Sie haben ${prize.name} gewonnen!`;

    if (prize.type === 'euro') {
      message += ` ${actualPrizeValue}€ (${prize.percentage}% Ihres Vermögens) wurden Ihrem Konto gutgeschrieben!`;
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

  getActualPrizeValue(prize: Prize): number {
    const userData = localStorage.getItem('currentUser');
    const currentUser = userData ? JSON.parse(userData) : null;
    const currentBalance = currentUser?.balance || 10000;
    return Math.round((currentBalance * prize.percentage) / 100);
  }

  formatPrizeLabel(prize: Prize): string {
    const actualValue = this.getActualPrizeValue(prize);

    if (actualValue >= 1000000) {
      return `${(actualValue / 1000000).toFixed(1)}Mil`;
    } else if (actualValue >= 1000) {
      return `${(actualValue / 1000).toFixed(1)}K`;
    } else {
      return `${actualValue}€`;
    }
  }

  loadCurrentBalanceAndUpdateWheel() {
    try {
      const userData = localStorage.getItem('currentUser');
      if (userData) {
        const currentUser = JSON.parse(userData);

        // Lade aktuelles Vermögen von der API
        this.http
          .get(
            `${environment.apiUrl}/get_balance.php?user_id=${currentUser.id}`
          )
          .subscribe({
            next: (response: any) => {
              if (response.success) {
                // Aktualisiere das Vermögen im localStorage
                currentUser.balance = response.balance;
                localStorage.setItem(
                  'currentUser',
                  JSON.stringify(currentUser)
                );

                // Aktualisiere die Sektoren mit dem aktuellen Vermögen
                this.updateWheelLabels();
                console.log('Vermögen geladen:', response.balance);
              } else {
                console.error(
                  'Fehler beim Laden des Vermögens:',
                  response.message
                );
                // Fallback auf localStorage oder Standardwert
                this.updateWheelLabels();
              }
            },
            error: (error) => {
              console.error('Fehler beim Laden des Vermögens:', error);
              // Fallback auf localStorage oder Standardwert
              this.updateWheelLabels();
            },
          });
      } else {
        // Kein Benutzer gefunden, verwende Standardwert
        this.updateWheelLabels();
      }
    } catch (error) {
      console.error('Fehler beim Laden des Benutzers:', error);
      this.updateWheelLabels();
    }
  }

  updateWheelLabels() {
    // Aktualisiere die Labels basierend auf dem aktuellen Vermögen
    this.sectors = this.prizes.map((prize, i) => {
      return {
        color: COLORS[i % COLORS.length],
        label: this.formatPrizeLabel(prize),
        prize: prize,
      };
    });

    // Zeichne das Rad neu
    if (this.wheel) {
      this.createWheel();
    }
  }

  // Daily Spin Logic
  private checkDailySpinAvailability() {
    try {
      const userData = localStorage.getItem('currentUser');
      if (userData) {
        const currentUser = JSON.parse(userData);

        // Prüfe letzten Spin in der Datenbank
        this.http
          .get(
            `${environment.apiUrl}/lucky-wheel.php?action=check_spin&user_id=${currentUser.id}`
          )
          .subscribe({
            next: (response: any) => {
              if (response.success) {
                if (response.can_spin) {
                  this.isSpinBlocked = false;
                  this.canSpin = true;
                  this.lastSpinTime = null;
                  this.nextSpinTime = null;
                  this.timeUntilNextSpin = '';
                } else {
                  this.isSpinBlocked = true;
                  this.canSpin = false;
                  this.lastSpinTime = new Date(response.last_spin);
                  this.nextSpinTime = new Date(response.next_spin);
                  this.updateTimeUntilNextSpin();
                }
              } else {
                console.error(
                  'Fehler beim Prüfen der Spin-Verfügbarkeit:',
                  response.message
                );
                this.showToast(
                  'Fehler beim Prüfen der Spin-Verfügbarkeit',
                  'danger'
                );
              }
            },
            error: (error) => {
              console.error(
                'Fehler beim Prüfen der Spin-Verfügbarkeit:',
                error
              );
              this.showToast(
                'Fehler beim Prüfen der Spin-Verfügbarkeit',
                'danger'
              );
            },
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
