import { Component, ViewChild } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import axios from 'axios';
import { environment } from '../../environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface PurchaseResponse {
  success: boolean;
  message: string;
}

interface PurchaseData {
  user_id: number;
  investments: string; // Asset type (e.g., 'Bitcoin')
  shares: number; // calculatedShares
  amount: number; // investmentAmount
  purchase_price: number; // Price at purchase time
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  @ViewChild('lineChart', { static: false }) lineChart: any;
  chart: any;
  tableData: any[] = [];
  investmentAmount: number = 0;
  currentPrice: number = 0;
  calculatedShares: number = 0;
  userId: number = 9; // Deine Test-User-ID
  readonly ASSET_TYPE: string = 'Bitcoin'; // or you could make this dynamic if needed

  constructor(private http: HttpClient) {
    Chart.register(...registerables);
  }

  ionViewDidEnter() {
    this.fetchData();
  }

  async fetchData() {
    const options = {
      method: 'GET',
      url: environment.apiUrl + '/cache.php',
      withCredentials: true,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    };

    try {
      const response = await axios.request(options);
      console.log('API Response:', response.data);

      if (response.data.error) {
        console.error('API Error:', response.data.error);
        return;
      }

      const data = response.data;
      if (!data.chart?.result?.[0]) {
        console.error('Unexpected data format:', data);
        return;
      }

      const prices = data.chart.result[0].indicators?.quote[0]?.close || [];
      const timestamps = data.chart.result[0].timestamp || [];
      const volumes = data.chart.result[0].indicators?.quote[0]?.volume || [];

      // Format data for table
      this.tableData = timestamps.map((timestamp: number, index: number) => {
        const date = new Date(timestamp * 1000);
        return {
          date: `${date.getDate()}/${
            date.getMonth() + 1
          }/${date.getFullYear()}`,
          price: prices[index]?.toFixed(2) || 'N/A',
          volume: volumes[index]?.toLocaleString() || 'N/A',
        };
      });

      // Zeitstempel in lesbare Daten umwandeln
      const labels = timestamps.map((timestamp: number) => {
        const date = new Date(timestamp * 1000); // Unix-Timestamp in Millisekunden
        return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
      });

      console.log('Prices:', prices);
      console.log('Labels:', labels);

      this.createChart(prices, labels);

      // Aktualisiere den aktuellen Preis
      this.currentPrice =
        data.chart.result[0].indicators?.quote[0]?.close.slice(-1)[0] || 0;
      this.calculateShares();
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
    }
  }

  createChart(prices: number[], labels: string[]) {
    console.log('Creating chart with prices:', prices);

    if (this.chart) {
      this.chart.destroy(); // Chart resetten, wenn schon einer existiert
    }

    if (!this.lineChart?.nativeElement) {
      console.error('Canvas element not found!');
      return;
    }

    this.chart = new Chart(this.lineChart.nativeElement, {
      type: 'line',
      data: {
        labels: labels, // Zeitstempel als Labels
        datasets: [
          {
            label: 'Bitcoin Preis (USD)',
            data: prices, // Historische Preise
            borderColor: '#4caf50',
            backgroundColor: 'rgba(76, 175, 80, 0.2)',
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: true,
            position: 'top',
          },
        },
      },
    });
  }

  // Berechne die Anteile basierend auf dem Investitionsbetrag
  calculateShares() {
    if (this.currentPrice && this.investmentAmount) {
      this.calculatedShares = this.investmentAmount / this.currentPrice;
    }
  }

  // Kauflogik
  async buyBitcoin() {
    if (!this.investmentAmount || !this.currentPrice) {
      return;
    }

    // Nutze this.calculatedShares anstatt neu zu berechnen
    const purchaseData = {
      user_id: this.userId,
      investments: this.ASSET_TYPE,
      shares: this.calculatedShares, // Verwende die bereits berechneten shares
      amount: this.investmentAmount,
      purchase_price: this.currentPrice,
    };

    // Log zum Debugging
    console.log('Purchase Data being sent:', purchaseData);

    try {
      const response = await this.http
        .post<PurchaseResponse>(
          'http://localhost/stronks/backend/buy.php',
          purchaseData,
          {
            withCredentials: true,
            headers: new HttpHeaders({
              'Content-Type': 'application/json',
              Accept: 'application/json',
            }),
          }
        )
        .toPromise();

      console.log('Purchase response:', response);

      if (response?.success) {
        // Using optional chaining
        alert('Kauf erfolgreich!');
        this.investmentAmount = 0;
        this.calculatedShares = 0;
        await this.fetchData();
      } else {
        alert(response?.message || 'Kauf fehlgeschlagen');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      alert('Kauf fehlgeschlagen. Bitte versuchen Sie es erneut.');
    }
  }

  calculatePercentageChange(
    current_price: number,
    purchase_price: number
  ): number {
    return ((current_price - purchase_price) / purchase_price) * 100;
  }
  }
