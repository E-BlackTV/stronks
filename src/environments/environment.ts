import raw from '../../config.json';

export const environment = {
  production: false,
  rapidApiKey: raw.rapidApiKey,
  rapidApiHost: raw.rapidApiHost,
  apiUrl: '/backend', // Proxy über Angular Dev Server
};
