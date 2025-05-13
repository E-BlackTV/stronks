import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { LuckyWheelService } from '../../services/lucky-wheel.service';
import { AuthenticationService } from '../../services/authentication.service';
import { firstValueFrom } from 'rxjs';

interface WheelResponse {
  success: boolean;
  prize?: number;
  degrees?: number;
  message?: string;
}

@Component({
  selector: 'app-lucky-wheel',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Daily Lucky Wheel</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">
            <ion-icon name="close"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="wheel-container">
        <canvas #wheelCanvas width="400" height="400"></canvas>
        <div class="spin-button" [class.disabled]="isSpinning || !canSpin">
          <ion-button (click)="spin()" [disabled]="isSpinning || !canSpin">
            {{ canSpin ? 'SPIN!' : 'Come back tomorrow!' }}
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .wheel-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      min-height: 100%;
    }
    .spin-button {
      margin-top: 20px;
      z-index: 100;
    }
    .disabled {
      opacity: 0.5;
    }
    canvas {
      max-width: 100%;
      height: auto;
    }
  `]
})
export class LuckyWheelComponent implements OnInit, AfterViewInit {
  @ViewChild('wheelCanvas') wheelCanvas!: ElementRef<HTMLCanvasElement>;
  
  canSpin = true;
  isSpinning = false;
  ctx: CanvasRenderingContext2D | null = null;
  currentRotation = 0;
  
  private prizes = [
    { label: '100€', color: '#3880ff' },
    { label: '5€', color: '#2dd36f' },
    { label: '25€', color: '#3880ff' },
    { label: '10€', color: '#2dd36f' },
    { label: '50€', color: '#3880ff' },
    { label: '15€', color: '#2dd36f' },
    { label: '30€', color: '#3880ff' },
    { label: '20€', color: '#2dd36f' }
  ];

  constructor(
    private modalCtrl: ModalController,
    private luckyWheelService: LuckyWheelService,
    private authService: AuthenticationService
  ) {}

  ngOnInit() {
    this.checkSpinAvailability();
  }

  ngAfterViewInit() {
    this.ctx = this.wheelCanvas.nativeElement.getContext('2d');
    this.drawWheel();
  }

  drawWheel() {
    if (!this.ctx) return;
    
    const canvas = this.wheelCanvas.nativeElement;
    const ctx = this.ctx;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.prizes.forEach((prize, index) => {
      const startAngle = (index * 2 * Math.PI / this.prizes.length) + this.currentRotation;
      const endAngle = ((index + 1) * 2 * Math.PI / this.prizes.length) + this.currentRotation;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = prize.color;
      ctx.fill();
      ctx.stroke();

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + (Math.PI / this.prizes.length));
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px Arial';
      ctx.fillText(prize.label, radius - 20, 0);
      ctx.restore();
    });
  }

  async spin() {
    if (!this.canSpin || this.isSpinning) return;

    this.isSpinning = true;
    const userId = this.authService.currentUserValue?.id;

    if (userId) {
      try {
        // Initialize animation ID variable
        let currentAnimation = 0;
        
        // Start immediate rotation
        const preRotation = () => {
          this.currentRotation += 0.1;
          this.drawWheel();
          currentAnimation = window.requestAnimationFrame(preRotation);
        };
        
        // Start initial rotation
        currentAnimation = window.requestAnimationFrame(preRotation);

        const response = await firstValueFrom(this.luckyWheelService.spinWheel(userId));
        
        if (response?.success && response?.degrees !== undefined && response?.prize !== undefined) {
          // Stop the pre-rotation
          window.cancelAnimationFrame(currentAnimation);
          
          const targetRotation = (response.degrees * Math.PI) / 180;
          let start: number | null = null;
          const duration = 4000;

          const animate = (timestamp: number) => {
            if (!start) start = timestamp;
            const progress = (timestamp - start) / duration;

            if (progress < 1) {
              this.currentRotation = this.easeOut(progress) * targetRotation;
              this.drawWheel();
              requestAnimationFrame(animate);
            } else {
              this.isSpinning = false;
              this.canSpin = false;
              alert(`Congratulations! You won ${response.prize}€!`);
              this.modalCtrl.dismiss({ refresh: true });
            }
          };

          requestAnimationFrame(animate);
        } else {
          window.cancelAnimationFrame(currentAnimation);
          this.isSpinning = false;
          alert(response?.message || 'Error spinning the wheel');
        }
      } catch (error) {
        console.error('Spin error:', error);
        this.isSpinning = false;
        alert('Error while spinning the wheel');
      }
    }
  }

  private easeOut(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private checkSpinAvailability() {
    const userId = this.authService.currentUserValue?.id;
    if (userId) {
      this.luckyWheelService.checkLastSpin(userId).subscribe(
        response => {
          this.canSpin = response.canSpin;
        }
      );
    }
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }
}