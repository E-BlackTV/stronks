import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { tap, catchError, switchMap, map } from 'rxjs/operators';
import { FirestoreService } from './firestore.service';
import { FirebaseAdminService } from './firebase-admin.service';

export interface WheelResponse {
  success: boolean;
  message?: string;
  prizeAmount?: number;
  prizePercentage?: number;
  newBalance?: number;
}

@Injectable({
  providedIn: 'root',
})
export class LuckyWheelService {
  constructor(
    private http: HttpClient,
    private firestoreService: FirestoreService,
    private firebaseAdminService: FirebaseAdminService
  ) {}

  spinWheel(userId: string, forcedPercentage?: number): Observable<WheelResponse> {
    if (!userId) {
      return throwError(() => new Error('User ID is required'));
    }

    // 1) Prüfe letzten Spin
    return this.firestoreService.getLastSpin(userId).pipe(
      switchMap((last) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (last?.lastSpinDate) {
          const lastDate = (last.lastSpinDate as any).toDate?.() ?? new Date(last.lastSpinDate as any);
          lastDate.setHours(0, 0, 0, 0);
          if (today.getTime() === lastDate.getTime()) {
            return of({ success: false, message: 'Heute schon gedreht' });
          }
        }

        // 2) Lade aktuelles Guthaben
        return this.firestoreService.getUserBalance(userId).pipe(
          switchMap((balance) => {
            // 3) Gewinn-Prozentsatz (erzwingbar)
            const rawPercentage = typeof forcedPercentage === 'number' ? forcedPercentage : Math.random() * 9 + 1; // 1-10%
            const prizePercentage = Math.max(0, rawPercentage);
            const rawPrize = balance * (prizePercentage / 100);
            const prizeAmount = Math.round(rawPrize * 100) / 100; // auf 2 Nachkommastellen
            const newBalance = Math.round((balance + prizeAmount) * 100) / 100;

            // 4) Update Balance und Spin speichern
            return this.firestoreService.updateUserBalance(userId, newBalance).pipe(
              switchMap(() => this.firestoreService.setLastSpin(userId, prizeAmount, prizePercentage)),
              map(() => ({
                success: true,
                prizeAmount,
                prizePercentage,
                newBalance,
                message: 'Spin erfolgreich'
              } as WheelResponse))
            );
          })
        );
      }),
      catchError(this.handleError)
    );
  }

  checkLastSpin(userId: string): Observable<{ canSpin: boolean }> {
    if (!userId) {
      return throwError(() => new Error('User ID is required'));
    }

    return this.firestoreService.getLastSpin(userId).pipe(
      map((last) => {
        if (!last?.lastSpinDate) return { canSpin: true };
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastDate = (last.lastSpinDate as any).toDate?.() ?? new Date(last.lastSpinDate as any);
        lastDate.setHours(0, 0, 0, 0);
        return { canSpin: today.getTime() !== lastDate.getTime() };
      })
    );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }

    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
