# 📱 Ionic App Projekt: Trainings-Übungs/Game App

## 🛠️ Autoren: Emirhan Sahin & Julian Kuhl

---

## Inhalt

1. [Anforderungen](#anforderungen)
2. [Spezifikationen](#spezifikationen)
3. [Detailplanung](#detailplanung)
4. [Implementierung](#implementierung)

---

## Anforderungen

### Priorisierung
- **Must-Have**: 
  - Wallet mit aktuellen Aktien- und Crypto-Daten
  - Favoritenleiste
  - Top-Gewinner und Verlierer
  - Sortierbare Marktübersicht
  - Casino-Seite für Gamification
  - Einstellungen für Kontoverwaltung und Währungsumstellung
- **Nice-to-Have**:
  - Dark-Mode
  - Push-Benachrichtigungen für Kursänderungen
  - Interaktive Casino-Spiele
- **Optional**:
  - Integration von KI-gestützten Marktprognosen

---

## Spezifikationen

### Allgemein
- **Technologie**: Ionic Framework (Angular)
- **Zielplattform**: iOS, Android
- **Backend**: Firebase (für Authentifizierung und Datenhaltung)
- **Datenquellen**: API für Echtzeit-Aktien- und Crypto-Daten

### Seitenstruktur
1. **Wallet-Seite**:
   - Übersicht über aktuelle Aktien- und Crypto-Werte
   - Favoritenleiste (anpassbar)
   - Anzeige von Top-Gewinnern und -Verlierern
2. **Marktübersicht**:
   - Kompletter Markt (Aktien & Crypto)
   - Filter- und Sortiermöglichkeiten (z.B. nach Kursen, Veränderungen, Volumen)
3. **Casino-Seite**:
   - Glücksspielmöglichkeiten (z.B. Slotmaschinen, Würfeln)
   - Einsatz von Wallet-Guthaben
4. **Einstellungen**:
   - Kontomanagement (Passwort, Profilbild)
   - Währungsumstellung (z.B. USD, EUR, BTC)
   - Theme-Auswahl (z.B. Dark-/Light-Mode)

---

## Detailplanung

### Meilensteine
1. **MVP (Minimal Viable Product)**:
   - Wallet-Seite mit Favoritenleiste und Marktübersicht
   - Funktionierende API-Anbindung
   - Basis-Casino-Seite mit einer einfachen Spieloption
   - Einstellungsseite mit Währungsumstellung
2. **Erweiterung**:
   - Erweiterte Filter-/Sortieroptionen in der Marktübersicht
   - Interaktive Spiele im Casino
   - Push-Benachrichtigungen
3. **Finalisierung**:
   - UI/UX-Verbesserungen
   - Performance-Optimierung

### Zeitschätzung
- **Phase 1**: 2 Wochen für Grundstruktur & API-Integration
- **Phase 2**: 3 Wochen für Casino-Funktionalitäten
- **Phase 3**: 1 Woche für Feinschliff und Tests

---

## Implementierung

### Tools und Technologien
- **Frontend**: Ionic, Angular
- **Backend**: Firebase Realtime Database
- **API**: CoinGecko API, Alpha Vantage API
- **Design**: Figma für Prototyping
- **Testing**: Jasmine, Karma

### Verzeichnisstruktur
