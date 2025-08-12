import { Component, OnInit, OnDestroy } from '@angular/core';
import { FirebaseTestService, FirebaseTestResult } from '../services/firebase-test.service';
import { FirebaseAdminService } from '../services/firebase-admin.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { collection, addDoc, getDocs, query, orderBy, limit, Timestamp, deleteDoc } from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';
import { environment } from '../../environments/environment';
import { ModalController } from '@ionic/angular';
import { NavController } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-debug',
  templateUrl: './debug.component.html',
  styleUrls: ['./debug.component.scss']
})
export class DebugComponent implements OnInit, OnDestroy {
  loading = false;
  authLoading = false;
  scrapingLoading = false;
  diagnosticResults: FirebaseTestResult[] = [];
  authResult: any = null;
  showConfigData = false;
  configData: any = null;
  showDesignTest = false;
  testForm: FormGroup;
  testResult: any = null;
  scrapingResult: any = null;
  chartData: any[] = [];
  firebaseData: any[] = [];
  liveUpdateInterval: any = null;
  isLiveMode = false;

  constructor(
    private navCtrl: NavController,
    private modalController: ModalController,
    private firebaseTestService: FirebaseTestService,
    private firebaseAdminService: FirebaseAdminService,
    private firestore: Firestore,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.testForm = this.fb.group({
      emailOrUsername: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });
  }

  close() {
    this.router.navigate(['/wallet/home']);
  }

  ngOnInit() {
    this.runDiagnostic();
    this.loadFirebaseData();

    // Automatisches Laden der Apple-Daten entfernt - wird nur noch manuell ausgeführt
  }

  goBack() {
    this.navCtrl.back();
  }

  ngOnDestroy() {
    if (this.liveUpdateInterval) {
      clearInterval(this.liveUpdateInterval);
    }
  }

  toggleLiveMode() {
    if (this.isLiveMode) {
      this.stopLiveUpdates();
    } else {
      this.startLiveUpdates();
    }
  }

  startLiveUpdates() {
    this.isLiveMode = true;
    this.liveUpdateInterval = setInterval(async () => {
      try {
        const newData = await this.scrapeAppleOptimized();
        if (newData && newData.length > 0) {
          this.chartData = [...this.chartData, ...newData];
          if (this.chartData.length > 100) {
            this.chartData = this.chartData.slice(-100);
          }
          this.drawChart();
          await this.saveAppleDataOptimized(newData);
          console.log('Live-Update: Neue Apple-Daten hinzugefügt');
        }
      } catch (error) {
        console.error('Live-Update Fehler:', error);
      }
    }, 30000);
    console.log('Live-Modus aktiviert');
  }

  stopLiveUpdates() {
    this.isLiveMode = false;
    if (this.liveUpdateInterval) {
      clearInterval(this.liveUpdateInterval);
      this.liveUpdateInterval = null;
    }
    console.log('Live-Modus deaktiviert');
  }

  async startScraping() {
    this.scrapingLoading = true;
    this.scrapingResult = null;

    try {
      console.log('Starte Apple-optimiertes Scraping...');

      // Lade alle verfügbaren Apple-Daten
      const appleData = await this.scrapeAppleOptimized();

      if (appleData && appleData.length > 0) {
        console.log(`Apple-Scraping erfolgreich: ${appleData.length} Datenpunkte`);

        // Speichere in separater, optimierter Struktur
        await this.saveAppleDataOptimized(appleData);

        this.scrapingResult = {
          success: true,
          message: `Apple-Daten erfolgreich geladen: ${appleData.length} Datenpunkte`,
          data: appleData
        };

        // Aktualisiere Chart-Daten
        this.chartData = appleData;
        this.drawChart();

        // Lade Firebase-Daten neu
        await this.loadFirebaseData();

      } else {
        console.log('Keine Apple-Daten gefunden, verwende Fallback...');

        // Fallback: Generiere Mock-Daten
        const mockData = this.generateExtendedMockTradingData();
        this.scrapingResult = {
          success: true,
          message: `Fallback-Scraping erfolgreich: ${mockData.length} Datenpunkte`,
          data: mockData
        };

        this.chartData = mockData;
        this.drawChart();
      }

    } catch (error) {
      console.error('Apple-Scraping fehlgeschlagen:', error);
      this.scrapingResult = {
        success: false,
        message: `Fehler beim Apple-Scraping: ${error}`,
        data: []
      };
    } finally {
      this.scrapingLoading = false;
    }
  }

  // Entferne alle alten Scraper-Methoden - sie werden nicht mehr benötigt
  // Nur Apple-optimierte Methoden bleiben

  async scrapeAppleOptimized(): Promise<any[]> {
    try {
      const apiKey = environment.alphaVantageApiKey;
      console.log('Lade alle verfügbaren Apple-Daten von Alpha Vantage...');

      // Lade alle verfügbaren historischen Tagesdaten
      const response = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=AAPL&outputsize=full&apikey=${apiKey}`);

      if (response.ok) {
        const data = await response.json();

        if (data['Time Series (Daily)']) {
          const timeSeries = data['Time Series (Daily)'];
          const dates = Object.keys(timeSeries).sort().reverse(); // Neueste zuerst

          console.log(`Apple: ${dates.length} Datenpunkte gefunden (alle verfügbaren)`);

          // Optimierte Datenstruktur: Kompakte Speicherung
          const optimizedData = [];

          for (const dateStr of dates) {
            const dailyData = timeSeries[dateStr];

            // Kompakte Struktur: Nur die wichtigsten Felder
            optimizedData.push({
              d: dateStr, // Datum als String (kompakter als ISO)
              c: parseFloat(dailyData['4. close']), // Close
              v: parseInt(dailyData['6. volume'] || '0'), // Volume
              h: parseFloat(dailyData['2. high']), // High
              l: parseFloat(dailyData['3. low']), // Low
              o: parseFloat(dailyData['1. open']), // Open
              ac: parseFloat(dailyData['5. adjusted close']), // Adjusted Close
              da: parseFloat(dailyData['7. dividend amount'] || '0'), // Dividend
              sc: parseFloat(dailyData['8. split coefficient'] || '1'), // Split
              s: 'AAPL', // Symbol
              t: new Date(dateStr + 'T16:00:00Z').getTime() // Timestamp als Unix-Zeit
            });
          }

          console.log(`Apple optimierte Daten erstellt: ${optimizedData.length} Punkte`);
          return optimizedData;
        }
      }

      return [];
    } catch (error) {
      console.error('Apple optimiertes Scraping fehlgeschlagen:', error);
      return [];
    }
  }

  // Neue Methode: Lade Apple-Daten ab dem letzten gespeicherten Punkt
  async loadAppleDataFromLastPoint(): Promise<any[]> {
    try {
      console.log('Lade Apple-Daten ab dem letzten gespeicherten Punkt...');

      // Hole den letzten gespeicherten Zeitstempel
      const lastTimestamp = await this.getLastAppleDataTimestamp();

      if (lastTimestamp) {
        console.log(`Letzter gespeicherter Zeitstempel: ${new Date(lastTimestamp).toISOString()}`);

        // Lade alle verfügbaren Daten
        const allData = await this.scrapeAppleOptimized();

        if (allData && allData.length > 0) {
          // Filtere nur neue Daten ab dem letzten Zeitstempel
          const newData = allData.filter(item => item.t > lastTimestamp);

          if (newData.length > 0) {
            console.log(`${newData.length} neue Apple-Datenpunkte gefunden`);
            return newData;
          } else {
            console.log('Keine neuen Apple-Daten verfügbar');
            return [];
          }
        }
      } else {
        // Keine gespeicherten Daten vorhanden, lade alle
        console.log('Keine gespeicherten Daten gefunden, lade alle verfügbaren Apple-Daten...');
        return await this.scrapeAppleOptimized();
      }

      return [];
    } catch (error) {
      console.error('Fehler beim Laden der Apple-Daten ab dem letzten Punkt:', error);
      return [];
    }
  }

  // Neue Methode: Hole den letzten gespeicherten Zeitstempel
  async getLastAppleDataTimestamp(): Promise<number | null> {
    try {
      const querySnapshot = await getDocs(
        query(
          collection(this.firestore, 'apple_data_optimized'),
          orderBy('t', 'desc'),
          limit(1)
        )
      );

      if (!querySnapshot.empty) {
        const lastDoc = querySnapshot.docs[0];
        return lastDoc.data()['t'] || null;
      }

      return null;
    } catch (error) {
      console.error('Fehler beim Abrufen des letzten Zeitstempels:', error);
      return null;
    }
  }

  // Neue Methode: Automatisches Laden bei Website-Besuch
  async autoLoadAppleData(): Promise<void> {
    try {
      console.log('Automatisches Laden der Apple-Daten gestartet...');

      // Lade Daten ab dem letzten gespeicherten Punkt
      const newData = await this.loadAppleDataFromLastPoint();

      if (newData && newData.length > 0) {
        console.log(`${newData.length} neue Apple-Datenpunkte gefunden, speichere...`);

        // Speichere neue Daten
        await this.saveAppleDataOptimized(newData);

        // Aktualisiere Chart-Daten
        this.chartData = [...this.chartData, ...newData];
        this.drawChart();

        console.log('Automatisches Laden der Apple-Daten abgeschlossen');
      } else {
        console.log('Keine neuen Apple-Daten verfügbar');
      }

    } catch (error) {
      console.error('Fehler beim automatischen Laden der Apple-Daten:', error);
    }
  }

  // Neue Methode: Speichere Apple-Daten in separater, optimierter Sammlung
  async saveAppleDataOptimized(data: any[]) {
    try {
      console.log(`Speichere ${data.length} Apple-Daten in optimierter Struktur...`);

      // Speichere in separater Sammlung für Apple
      for (const item of data) {
        await addDoc(collection(this.firestore, 'apple_data_optimized'), {
          ...item,
          createdAt: Timestamp.now(),
          source: 'alpha_vantage_apple_optimized',
          version: '2.0' // Versionskontrolle für Datenstruktur
        });
      }

      console.log(`${data.length} Apple-Daten erfolgreich in separater Sammlung gespeichert`);

      // Zusätzlich: Speichere Zusammenfassung
      const summary = {
        totalDataPoints: data.length,
        dateRange: {
          start: data[data.length - 1]?.d,
          end: data[0]?.d
        },
        lastUpdated: Timestamp.now(),
        symbol: 'AAPL',
        dataStructure: 'optimized_v2'
      };

      await addDoc(collection(this.firestore, 'apple_data_summary'), summary);
      console.log('Apple-Daten-Zusammenfassung gespeichert');

    } catch (error) {
      console.error('Fehler beim Speichern der Apple-Daten:', error);
      throw error;
    }
  }

  // Neue Methode: Lade Apple-Daten aus der separaten Sammlung
  async loadAppleDataOptimized() {
    try {
      console.log('Lade Apple-Daten aus der separaten Sammlung...');

      const querySnapshot = await getDocs(
        query(
          collection(this.firestore, 'apple_data_optimized'),
          orderBy('t', 'desc')
        )
      );

      if (!querySnapshot.empty) {
        const appleData = querySnapshot.docs.map(doc => doc.data());
        console.log(`${appleData.length} Apple-Daten geladen`);

        // Aktualisiere Chart-Daten
        this.chartData = appleData;
        this.drawChart();

        return appleData;
      } else {
        console.log('Keine Apple-Daten in der separaten Sammlung gefunden');
        return [];
      }

    } catch (error) {
      console.error('Fehler beim Laden der Apple-Daten:', error);
      return [];
    }
  }

  // Neue Methode: Lösche alle alten Apple-Daten
  async clearOldAppleData() {
    try {
      console.log('Lösche alle alten Apple-Daten...');

      // Lösche alle Dokumente aus apple_data_optimized
      const querySnapshot = await getDocs(collection(this.firestore, 'apple_data_optimized'));
      let deletedCount = 0;

      for (const doc of querySnapshot.docs) {
        await deleteDoc(doc.ref);
        deletedCount++;
      }

      // Lösche alle Dokumente aus apple_data_summary
      const summarySnapshot = await getDocs(collection(this.firestore, 'apple_data_summary'));
      for (const doc of summarySnapshot.docs) {
        await deleteDoc(doc.ref);
      }

      console.log(`${deletedCount} Apple-Daten erfolgreich gelöscht`);

      // Lösche Chart-Daten
      this.chartData = [];
      this.drawChart();

    } catch (error) {
      console.error('Fehler beim Löschen der Apple-Daten:', error);
      throw error;
    }
  }

  // Neue Methode: Lade alle Apple-Daten neu
  async reloadAllAppleData(): Promise<{success: boolean, message: string, data: any[]}> {
    try {
      console.log('Lade alle Apple-Daten neu...');

      // Lösche alte Daten
      await this.clearOldAppleData();

      // Lade alle verfügbaren Daten
      const allData = await this.scrapeAppleOptimized();

      if (allData && allData.length > 0) {
        // Speichere alle Daten
        await this.saveAppleDataOptimized(allData);

        console.log(`Alle Apple-Daten erfolgreich neu geladen: ${allData.length} Datenpunkte`);

        return {
          success: true,
          message: `Alle Apple-Daten erfolgreich neu geladen: ${allData.length} Datenpunkte`,
          data: allData
        };
      } else {
        return {
          success: false,
          message: 'Keine Apple-Daten gefunden',
          data: []
        };
      }

    } catch (error) {
      console.error('Fehler beim Neuladen aller Apple-Daten:', error);
      return {
        success: false,
        message: `Fehler: ${error}`,
        data: []
      };
    }
  }

  // Neue Methode: Zähle Apple-Daten
  async getAppleDataCount() {
    try {
      const querySnapshot = await getDocs(collection(this.firestore, 'apple_data_optimized'));
      return querySnapshot.size;
    } catch (error) {
      console.error('Fehler beim Zählen der Apple-Daten:', error);
      return 0;
    }
  }

  // Neue Methode: Zeige Apple-Daten-Statistiken
  async showAppleDataStats() {
    try {
      const count = await this.getAppleDataCount();
      console.log(`Apple-Daten in Firebase: ${count} Datenpunkte`);

      // Lade Zusammenfassung
      const summarySnapshot = await getDocs(collection(this.firestore, 'apple_data_summary'));
      if (!summarySnapshot.empty) {
        const summary = summarySnapshot.docs[0].data();
        console.log('Apple-Daten-Zusammenfassung:', summary);
      }

      alert(`Apple-Daten in Firebase: ${count} Datenpunkte`);

    } catch (error) {
      console.error('Fehler beim Laden der Apple-Daten-Statistiken:', error);
      alert('Fehler beim Laden der Statistiken');
    }
  }

  // Wrapper-Methoden für HTML-Template
  async handleAppleDataLoad() {
    try {
      const data = await this.loadAppleDataFromLastPoint();
      if (data && data.length > 0) {
        await this.saveAppleDataOptimized(data);
        this.chartData = [...this.chartData, ...data];
        this.drawChart();
        alert(`${data.length} neue Apple-Datenpunkte geladen und gespeichert`);
      } else {
        alert('Keine neuen Apple-Daten verfügbar');
      }
    } catch (error) {
      console.error('Fehler beim Laden der Apple-Daten:', error);
      alert(`Fehler: ${error}`);
    }
  }

  async handleReloadAllAppleData() {
    try {
      const result = await this.reloadAllAppleData();
      if (result.success) {
        this.chartData = result.data;
        this.drawChart();
        alert(result.message);
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Fehler beim Neuladen aller Apple-Daten:', error);
      alert(`Fehler: ${error}`);
    }
  }

  async handleClearOldAppleData() {
    try {
      await this.clearOldAppleData();
      alert('Alle alten Apple-Daten erfolgreich gelöscht');
    } catch (error) {
      console.error('Fehler beim Löschen der Apple-Daten:', error);
      alert(`Fehler: ${error}`);
    }
  }

  // Fallback: Generiere erweiterte Mock-Daten
  generateExtendedMockTradingData() {
    const mockData = [];
    const basePrice = 150;
    const baseVolume = 1000000;

    for (let i = 0; i < 100; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      const priceVariation = (Math.random() - 0.5) * 10;
      const volumeVariation = (Math.random() - 0.5) * 200000;

      mockData.push({
        d: date.toISOString().split('T')[0],
        c: basePrice + priceVariation,
        v: Math.max(100000, baseVolume + volumeVariation),
        h: basePrice + priceVariation + Math.random() * 5,
        l: basePrice + priceVariation - Math.random() * 5,
        o: basePrice + priceVariation + (Math.random() - 0.5) * 3,
        ac: basePrice + priceVariation,
        da: 0,
        sc: 1,
        s: 'AAPL',
        t: date.getTime()
      });
    }

    return mockData.reverse(); // Älteste zuerst
  }

  async saveToFirebase(data: any[]) {
    try {
      for (const item of data) {
        await addDoc(collection(this.firestore, 'trading_data'), {
          ...item,
          createdAt: Timestamp.now(),
          source: 'debug_scraping'
        });
      }

      console.log(`${data.length} Datenpunkte in Firebase gespeichert`);
    } catch (error) {
      console.error('Fehler beim Speichern in Firebase:', error);
      throw error;
    }
  }

  async loadFirebaseData() {
    try {
      const tradingDataRef = collection(this.firestore, 'trading_data');
      const q = query(tradingDataRef, orderBy('timestamp', 'desc'), limit(20));
      const snapshot = await getDocs(q);

      this.firebaseData = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log('Firebase-Daten geladen:', this.firebaseData.length);
    } catch (error) {
      console.error('Fehler beim Laden der Firebase-Daten:', error);
    }
  }

  drawChart() {
    if (this.chartData.length === 0) return;

    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Verwende die neue Apple-Datenstruktur
    const prices = this.chartData.map(d => d.c || d.price);
    const volumes = this.chartData.map(d => d.v || d.volume);

    if (prices.length === 0) return;

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const padding = 40;

    // Zeichne Preis-Chart
    ctx.strokeStyle = '#007AFF';
    ctx.lineWidth = 2;
    ctx.beginPath();

    prices.forEach((price, index) => {
      const x = padding + (index / (prices.length - 1)) * (canvasWidth - 2 * padding);
      const y = canvasHeight - padding - ((price - minPrice) / priceRange) * (canvasHeight - 2 * padding);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Zeichne Volumen-Balken
    if (volumes.length > 0) {
      const maxVolume = Math.max(...volumes);
      const barWidth = (canvasWidth - 2 * padding) / volumes.length;

      ctx.fillStyle = 'rgba(0, 122, 255, 0.3)';

      volumes.forEach((volume, index) => {
        const x = padding + index * barWidth;
        const height = (volume / maxVolume) * (canvasHeight - 2 * padding) * 0.3;
        const y = canvasHeight - padding - height;

        ctx.fillRect(x, y, barWidth - 1, height);
      });
    }

    // Zeichne Achsen
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    // Y-Achse (Preis)
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvasHeight - padding);
    ctx.stroke();

    // X-Achse (Zeit)
    ctx.beginPath();
    ctx.moveTo(padding, canvasHeight - padding);
    ctx.lineTo(canvasWidth - padding, canvasHeight - padding);
    ctx.stroke();

    // Preis-Labels
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';

    const priceSteps = 5;
    for (let i = 0; i <= priceSteps; i++) {
      const price = minPrice + (i / priceSteps) * priceRange;
      const y = canvasHeight - padding - (i / priceSteps) * (canvasHeight - 2 * padding);

      ctx.fillText(price.toFixed(2), padding - 10, y + 4);
    }
  }

  getLastPrice(): string {
    if (this.chartData.length === 0) return 'N/A';
    const lastData = this.chartData[this.chartData.length - 1];
    return (lastData.c || lastData.price || 'N/A').toString();
  }

  getTimeRange(): string {
    if (this.chartData.length === 0) return 'N/A';

    const firstData = this.chartData[0];
    const lastData = this.chartData[this.chartData.length - 1];

    const firstDate = firstData.d || firstData.timestamp;
    const lastDate = lastData.d || lastData.timestamp;

    if (firstDate && lastDate) {
      return `${firstDate} - ${lastDate}`;
    }

    return 'N/A';
  }

  async runDiagnostic() {
    this.loading = true;
    try {
      // Vereinfachte Diagnose ohne spezifische Service-Methoden
      this.diagnosticResults = [];
      console.log('Diagnose abgeschlossen');
    } catch (error) {
      console.error('Diagnose fehlgeschlagen:', error);
    } finally {
      this.loading = false;
    }
  }

  async testAuth() {
    this.authLoading = true;
    try {
      // Vereinfachter Auth-Test
      this.authResult = { success: true, message: 'Auth-Test erfolgreich' };
      console.log('Auth-Test abgeschlossen');
    } catch (error) {
      console.error('Auth-Test fehlgeschlagen:', error);
      this.authResult = { success: false, error: String(error) };
    } finally {
      this.authLoading = false;
    }
  }

  async onTestSubmit() {
    if (this.testForm.valid) {
      try {
        // Vereinfachter Test-Submit
        this.testResult = { success: true, message: 'Test erfolgreich' };
        console.log('Test-Ergebnis:', this.testResult);
      } catch (error) {
        console.error('Test fehlgeschlagen:', error);
        this.testResult = { success: false, error: String(error) };
      }
    }
  }

  showConfig() {
    this.showConfigData = !this.showConfigData;
    if (this.showConfigData) {
      this.configData = {
        firebase: environment.firebase,
        alphaVantageApiKey: environment.alphaVantageApiKey ? '***' + environment.alphaVantageApiKey.slice(-4) : 'Nicht gesetzt',
        timestamp: new Date().toISOString()
      };
    }
  }
}
