# Firebase Backend Setup

## Übersicht

Diese Anleitung beschreibt, wie Sie das PHP-Backend durch Firebase Functions ersetzen können.

## 1. Firebase Functions erstellen

### 1.1 Functions-Verzeichnis erstellen

```bash
mkdir functions
cd functions
npm init -y
```

### 1.2 Dependencies installieren

```bash
npm install firebase-admin firebase-functions axios
```

### 1.3 Functions deployen

```bash
firebase deploy --only functions
```

## 2. Firebase-Konfiguration

### 2.1 Firebase CLI installieren

```bash
npm install -g firebase-tools
```

### 2.2 Firebase-Projekt initialisieren

```bash
firebase login
firebase init functions
```

### 2.3 Projekt-ID konfigurieren

Stellen Sie sicher, dass die Projekt-ID in `firebase.json` korrekt ist:

```json
{
  "functions": {
    "source": "functions"
  }
}
```

## 3. Environment-Konfiguration

### 3.1 Functions-URL aktualisieren

In `src/app/services/firebase-backend.service.ts` die Functions-URL anpassen:

```typescript
private functionsUrl = 'https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net';
```

## 4. Firestore-Datenbank einrichten

### 4.1 Collections erstellen

Erstellen Sie folgende Collections in Firestore:

- `users` - Benutzerdaten
- `portfolios` - Portfolio-Daten
- `transactions` - Transaktionshistorie
- `luckyWheelSpins` - Lucky Wheel Spins

### 4.2 Firestore-Regeln

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Benutzer können nur ihre eigenen Daten lesen/schreiben
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /portfolios/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /transactions/{transactionId} {
      allow read, write: if request.auth != null &&
        resource.data.userId == request.auth.uid;
    }

    match /luckyWheelSpins/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 5. Deployment-Schritte

### 5.1 Functions deployen

```bash
cd functions
npm run deploy
```

### 5.2 Frontend deployen

```bash
ionic build --prod
firebase deploy --only hosting
```

## 6. Migration von PHP zu Firebase

### 6.1 Daten migrieren

- Exportieren Sie die Daten aus der MySQL-Datenbank
- Konvertieren Sie die Daten in Firestore-Format
- Importieren Sie die Daten in Firestore

### 6.2 API-Endpunkte ersetzen

Alle PHP-Endpunkte wurden durch Firebase Functions ersetzt:

- `/backend/trade.php` → `executeTrade`
- `/backend/get_portfolio_new.php` → `getPortfolio`
- `/backend/get_balance.php` → `getBalance`
- `/backend/cache.php` → `getAssetPrice`
- `/backend/lucky-wheel.php` → `spinLuckyWheel`

## 7. Vorteile der Firebase-Lösung

### 7.1 Skalierbarkeit

- Automatische Skalierung
- Keine Server-Verwaltung
- Globale Verfügbarkeit

### 7.2 Sicherheit

- Integrierte Authentifizierung
- Firestore-Sicherheitsregeln
- HTTPS standardmäßig

### 7.3 Kosten

- Pay-per-use Modell
- Keine Infrastruktur-Kosten
- Kostenloses Tier verfügbar

## 8. Troubleshooting

### 8.1 CORS-Fehler

Falls CORS-Fehler auftreten, fügen Sie in den Functions CORS-Header hinzu:

```javascript
const cors = require("cors")({ origin: true });
```

### 8.2 Authentifizierung

Stellen Sie sicher, dass die Firebase-Authentifizierung korrekt konfiguriert ist.

### 8.3 Firestore-Regeln

Überprüfen Sie die Firestore-Regeln, falls Datenzugriffe fehlschlagen.

## 9. Monitoring

### 9.1 Firebase Console

- Überwachen Sie die Functions-Ausführungen
- Prüfen Sie die Logs
- Überwachen Sie die Kosten

### 9.2 Error Handling

Implementieren Sie umfassendes Error Handling in den Functions.

## 10. Backup und Wiederherstellung

### 10.1 Daten exportieren

```bash
firebase firestore:export
```

### 10.2 Daten importieren

```bash
firebase firestore:import
```

## Nächste Schritte

1. Deployen Sie die Functions
2. Testen Sie alle Endpunkte
3. Migrieren Sie die Daten
4. Aktualisieren Sie die Frontend-Konfiguration
5. Deployen Sie das Frontend
