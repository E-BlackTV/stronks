import raw from '../../config.json';

export const environment = {
  production: false,
  rapidApiKey: raw.rapidApiKey,
  rapidApiHost: raw.rapidApiHost,
  apiUrl: 'https://web053.wifiooe.at/backend', // Direkte Server-Verbindung
};
