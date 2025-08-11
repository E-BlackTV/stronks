import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable()
export class CorsInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Füge CORS-Header NUR für lokale APIs hinzu, nicht für externe APIs
    if (!environment.production && this.isLocalApi(request.url)) {
      request = request.clone({
        setHeaders: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
        }
      });
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 0) {
          console.error('CORS-Fehler oder Netzwerkproblem:', error);
          return throwError(() => new Error('CORS-Fehler: Der Server ist nicht erreichbar oder CORS ist nicht konfiguriert.'));
        }
        return throwError(() => error);
      })
    );
  }

  private isLocalApi(url: string): boolean {
    // Prüfe ob es eine lokale API ist (localhost, relative URL, oder eigene Domain)
    return url.startsWith('/') || 
           url.includes('localhost') || 
           url.includes('127.0.0.1') ||
           url.includes('stronks-d3008.web.app') ||
           url.includes('stronks-d3008.firebaseapp.com');
  }
} 