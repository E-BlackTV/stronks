// Firebase Service Worker für Push-Benachrichtigungen
importScripts(
  "https://www.gstatic.com/firebasejs/10.19.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.19.0/firebase-messaging-compat.js"
);

// Firebase Konfiguration
firebase.initializeApp({
  apiKey: "AIzaSyBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "stronks-d3008.firebaseapp.com",
  projectId: "stronks-d3008",
  storageBucket: "stronks-d3008.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890",
  measurementId: "G-XXXXXXXXXX",
});

const messaging = firebase.messaging();

// Hintergrund-Nachrichten verarbeiten
messaging.onBackgroundMessage((payload) => {
  console.log("Received background message:", payload);

  const notificationTitle = payload.notification?.title || "Stronks Update";
  const notificationOptions = {
    body: payload.notification?.body || "Neue Nachricht verfügbar",
    icon: "/assets/icon/favicon.png",
    badge: "/assets/icon/favicon.png",
    data: payload.data,
    actions: [
      {
        action: "open",
        title: "Öffnen",
      },
      {
        action: "close",
        title: "Schließen",
      },
    ],
  };

  return self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );
});

// Notification Click Handler
self.addEventListener("notificationclick", (event) => {
  console.log("Notification clicked:", event);

  event.notification.close();

  if (event.action === "open") {
    // App öffnen
    event.waitUntil(clients.openWindow("/"));
  }
});

// Push-Benachrichtigungen abonnieren
self.addEventListener("push", (event) => {
  console.log("Push event received:", event);

  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || "Neue Nachricht verfügbar",
      icon: "/assets/icon/favicon.png",
      badge: "/assets/icon/favicon.png",
      data: data,
      actions: [
        {
          action: "open",
          title: "Öffnen",
        },
        {
          action: "close",
          title: "Schließen",
        },
      ],
    };

    event.waitUntil(
      self.registration.showNotification(
        data.title || "Stronks Update",
        options
      )
    );
  }
});

// Service Worker Installation
self.addEventListener("install", (event) => {
  console.log("Service Worker installing...");
  self.skipWaiting();
});

// Service Worker Aktivierung
self.addEventListener("activate", (event) => {
  console.log("Service Worker activating...");
  event.waitUntil(self.clients.claim());
});

// Cache-Strategie für Offline-Funktionalität
self.addEventListener("fetch", (event) => {
  // API-Aufrufe nicht cachen
  if (event.request.url.includes("/api/")) {
    return;
  }

  // Statische Assets cachen
  if (
    event.request.destination === "image" ||
    event.request.destination === "style" ||
    event.request.destination === "script"
  ) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return (
          response ||
          fetch(event.request).then((fetchResponse) => {
            return caches.open("static-cache").then((cache) => {
              cache.put(event.request, fetchResponse.clone());
              return fetchResponse;
            });
          })
        );
      })
    );
  }
});
