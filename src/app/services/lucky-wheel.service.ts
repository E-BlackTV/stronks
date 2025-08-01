import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

interface WheelResponse {
  success: boolean;
  prize?: number;
  degrees?: number;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class LuckyWheelService {
  private apiUrl = '/backend/lucky-wheel.php'; // Proxy über Angular Dev Server

  constructor(private http: HttpClient) {}

  spinWheel(userId: number): Observable<WheelResponse> {
    if (!userId) {
      return throwError(() => new Error('User ID is required'));
    }

    return this.http
      .post<WheelResponse>(this.apiUrl, {
        user_id: userId,
        timestamp: Date.now(), // Füge Zeitstempel für zusätzliche Sicherheit hinzu
        action: 'spin',
      })
      .pipe(
        tap((response) => {
          if (!response.success) {
            throw new Error(response.message || 'Spin failed');
          }
        }),
        catchError(this.handleError)
      );
  }

  checkLastSpin(userId: number): Observable<{ canSpin: boolean }> {
    if (!userId) {
      return throwError(() => new Error('User ID is required'));
    }

    return this.http
      .get<{ canSpin: boolean }>(
        `${this.apiUrl}?user_id=${userId}&action=check`
      )
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }

    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
