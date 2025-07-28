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

const COLORS = ['#f82', '#0bf', '#fb0', '#0fb', '#b0f', '#f0b', '#bf0'];

interface Prize {
  id: number;
  name: string;
  value: number;
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
        color: COLORS[(i >= COLORS.length ? i + 1 : i) % COLORS.length],
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
  colors = ['#f82', '#0bf', '#fb0', '#0fb', '#b0f', '#f0b', '#bf0'];
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

  constructor(
    private modalController: ModalController,
    private toastController: ToastController,
    private http: HttpClient
  ) {}

  ngOnInit() {
    // Exakt wie im StackBlitz-Projekt
    this.prizes = [
      {
        id: 1,
        name: '100€',
        value: 100,
        type: 'euro',
        probability: 5,
        color: '#3880ff',
      },
      {
        id: 2,
        name: '5€',
        value: 5,
        type: 'euro',
        probability: 25,
        color: '#2dd36f',
      },
      {
        id: 3,
        name: '25€',
        value: 25,
        type: 'euro',
        probability: 15,
        color: '#3880ff',
      },
      {
        id: 4,
        name: '10€',
        value: 10,
        type: 'euro',
        probability: 20,
        color: '#2dd36f',
      },
      {
        id: 5,
        name: '50€',
        value: 50,
        type: 'euro',
        probability: 10,
        color: '#3880ff',
      },
      {
        id: 6,
        name: '15€',
        value: 15,
        type: 'euro',
        probability: 18,
        color: '#2dd36f',
      },
      {
        id: 7,
        name: '30€',
        value: 30,
        type: 'euro',
        probability: 12,
        color: '#3880ff',
      },
      {
        id: 8,
        name: '20€',
        value: 20,
        type: 'euro',
        probability: 15,
        color: '#2dd36f',
      },
    ];

    // Convert prizes to sectors for the wheel
    this.sectors = this.prizes.map((prize, i) => {
      return {
        color: COLORS[(i >= COLORS.length ? i + 1 : i) % COLORS.length],
        label: prize.name,
        prize: prize, // Speichere das komplette Prize-Objekt
      };
    });

    console.log('Sektoren initialisiert:', this.sectors.length);
  }

  ngAfterViewInit(): void {
    // Warte kurz bis DOM vollständig geladen ist
    setTimeout(() => {
      this.createWheel();
      // Starte Animation-Loop nur wenn Sektoren verfügbar sind
      if (this.sectors.length > 0) {
        this.startAnimationLoop();
      }
    }, 100);
  }

  ngOnDestroy(): void {
    this.stopAnimationLoop();
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

        this.http
          .post(`${environment.apiUrl}/lucky-wheel.php?action=spin_wheel`, {
            user_id: currentUser.id,
            prize_value: prize.value,
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
    let message = `Glückwunsch! Sie haben ${prize.name} gewonnen!`;

    if (prize.type === 'euro') {
      message += ` ${prize.value}€ wurden Ihrem Konto gutgeschrieben!`;
    } else if (prize.type === 'btc') {
      message += ` ${prize.value} BTC wurden Ihrem Portfolio hinzugefügt!`;
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
}
