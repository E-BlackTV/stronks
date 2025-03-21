import { Component, ViewChild } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import axios from 'axios';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  @ViewChild('lineChart', { static: false }) lineChart: any;
  chart: any;
  tableData: any[] = [];

  constructor() {
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
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
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
          date: `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`,
          price: prices[index]?.toFixed(2) || 'N/A',
          volume: volumes[index]?.toLocaleString() || 'N/A'
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
}
