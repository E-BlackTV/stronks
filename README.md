# Stronks - Trading App

Eine moderne Trading-App mit Angular, Ionic und Firebase.

## 🚀 Schnellstart

### Voraussetzungen

- Node.js (Version 16 oder höher)
- npm oder yarn
- Angular CLI
- Ionic CLI

### Installation

1. **Repository klonen**

```bash
git clone <repository-url>
cd stronks
```

2. **Abhängigkeiten installieren**

```bash
npm install
```

3. **Konfiguration einrichten**
   Bearbeite die `config.json` Datei mit deinen echten API-Schlüsseln:

```json
{
  "rapidApiKey": "dein-rapid-api-key",
  "rapidApiHost": "alpha-vantage.p.rapidapi.com",
  "firebaseApiKey": "dein-firebase-api-key",
  "firebaseAuthDomain": "dein-projekt.firebaseapp.com",
  "firebaseProjectId": "dein-projekt-id",
  "firebaseStorageBucket": "dein-projekt.appspot.com",
  "firebaseMessagingSenderId": "deine-sender-id",
  "firebaseAppId": "deine-app-id",
  "firebaseMeasurementId": "deine-measurement-id"
}
```

4. **Entwicklungsserver starten**

```bash
ionic serve
```

## 🔧 Konfiguration

### Firebase Setup

1. Erstelle ein neues Projekt auf [firebase.google.com](https://firebase.google.com)
2. Aktiviere Authentication und Firestore
3. Kopiere die Konfigurationsdaten
4. Füge sie in `config.json` ein

### RapidAPI Setup

1. Registriere dich auf [rapidapi.com](https://rapidapi.com)
2. Abonniere die Alpha Vantage API
3. Kopiere deinen API-Schlüssel
4. Füge ihn in `config.json` ein

## 🐛 Fehlerbehebung

### Firebase Fehler

**Problem**: Firebase-Konfigurationsfehler

**Lösungen**:

1. Überprüfe die Firebase-Konfiguration in `config.json`
2. Stelle sicher, dass Authentication und Firestore aktiviert sind
3. Überprüfe die Firestore-Regeln

### Netzwerkfehler

**Problem**: `Failed to fetch` oder Verbindungsfehler

**Lösungen**:

1. Überprüfe deine Internetverbindung
2. Stelle sicher, dass alle API-Schlüssel korrekt sind
3. Überprüfe die Firebase-Projekt-Einstellungen

## 📱 Build & Deploy

### Android Build

```bash
ionic capacitor add android
ionic capacitor build android
ionic capacitor open android
```

### iOS Build

```bash
ionic capacitor add ios
ionic capacitor build ios
ionic capacitor open ios
```

### Web Deploy

```bash
ionic build --prod
firebase deploy
```

## 🏗️ Projektstruktur

```
src/
├── app/
│   ├── components/          # Wiederverwendbare Komponenten
│   ├── services/           # Services für API-Calls
│   ├── guards/             # Route Guards
│   └── pages/              # App-Seiten
├── assets/                 # Statische Assets
├── environments/           # Umgebungsvariablen
└── lib/                    # Externe Bibliotheken
```

## 🤝 Beitragen

1. Fork das Repository
2. Erstelle einen Feature-Branch
3. Committe deine Änderungen
4. Push zum Branch
5. Erstelle einen Pull Request

## 📄 Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert.

## 🆘 Support

Bei Problemen:

1. Überprüfe die Fehlerbehebung oben
2. Schaue in die Issues
3. Erstelle ein neues Issue mit detaillierter Beschreibung
