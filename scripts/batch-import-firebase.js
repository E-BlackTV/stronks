const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Service Account Key laden
const serviceAccount = require("../functions/stronks-d3008-firebase-adminsdk-fbsvc-82078f8515.json");

// Firebase Admin SDK initialisieren
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

function removeUndefinedValues(obj) {
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../web053.json"), "utf8")
);

async function batchImport() {
  console.log("🚀 Starte Batch-Import aller Daten...");
  console.log("📍 Projekt: stronks-d3008");
  console.log("💰 Spark Plan (Free Tier)");
  console.log("📁 JSON-Datei:", path.join(__dirname, "../web053.json"));

  try {
    const collectionsToImport = [
      { name: "assets", firestoreCollection: "assets" },
      { name: "users", firestoreCollection: "users" },
      { name: "portfolio", firestoreCollection: "portfolios" },
      { name: "transactions", firestoreCollection: "trades" },
      { name: "lucky_wheel_spins", firestoreCollection: "lucky_wheel_spins" },
    ];

    for (const colConfig of collectionsToImport) {
      console.log(`\n🔄 Migriere ${colConfig.name}...`);
      const sourceData = data.find(
        (item) => item.type === "table" && item.name === colConfig.name
      );

      console.log(
        `📊 Gefundene Daten für ${colConfig.name}:`,
        sourceData ? `${sourceData.data?.length || 0} Einträge` : "Keine Daten"
      );

      if (sourceData && sourceData.data && sourceData.data.length > 0) {
        let writeBatch = db.batch();
        let counter = 0;
        const chunkSize = 400;

        for (const item of sourceData.data) {
          let docData;
          let docId = String(item.id);

          switch (colConfig.name) {
            case "assets":
              docData = {
                symbol: item.symbol,
                name: item.name,
                type: item.type,
                is_active: item.is_active === "1",
                created_at: admin.firestore.FieldValue.serverTimestamp(),
              };
              break;

            case "users":
              docData = {
                username: item.username,
                password_hash: item.password,
                balance: parseFloat(item.accountbalance) || 0,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                userId: docId,
              };
              break;

            case "portfolio":
              docData = {
                userId: item.user_id,
                symbol: item.asset_symbol,
                quantity: parseFloat(item.quantity) || 0,
                average_price: parseFloat(item.avg_purchase_price) || 0,
                total_invested: parseFloat(item.total_invested) || 0,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
              };
              break;

            case "transactions":
              docData = {
                userId: item.user_id,
                symbol: item.asset_symbol,
                type: item.type,
                quantity: parseFloat(item.quantity) || 0,
                price: parseFloat(item.price_per_unit) || 0,
                total: parseFloat(item.total_amount) || 0,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
              };
              break;

            case "lucky_wheel_spins":
              docData = {
                userId: item.user_id,
                last_spin: admin.firestore.FieldValue.serverTimestamp(),
              };
              break;
          }

          const cleanedDocData = removeUndefinedValues(docData);
          writeBatch.set(
            db.collection(colConfig.firestoreCollection).doc(docId),
            cleanedDocData
          );
          counter++;

          if (counter % chunkSize === 0 || counter === sourceData.data.length) {
            await writeBatch.commit();
            console.log(`✅ ${counter} ${colConfig.name} Dokumente committet.`);
            writeBatch = db.batch();
          }
        }
        console.log(`✅ ${counter} ${colConfig.name} Dokumente migriert.`);
      } else {
        console.log(`⏭️  ${colConfig.name}: Keine Daten gefunden.`);
      }
    }

    console.log("\n🎉 Batch-Import erfolgreich abgeschlossen!");
    console.log("📍 Ihre Daten finden Sie jetzt in der Firebase Console:");
    console.log(
      "   https://console.firebase.google.com/project/stronks-d3008/firestore"
    );
  } catch (error) {
    console.error("❌ Fehler beim Batch-Import:", error);
    console.error("Stack Trace:", error.stack);

    console.error("\n🔍 Debug-Informationen:");
    console.error(
      "- Service Account Pfad:",
      path.resolve(
        __dirname,
        "../functions/stronks-d3008-firebase-adminsdk-fbsvc-82078f8515.json"
      )
    );
    console.error(
      "- JSON-Datei Pfad:",
      path.resolve(__dirname, "../web053.json")
    );
    console.error(
      "- Service Account existiert:",
      fs.existsSync(
        path.resolve(
          __dirname,
          "../functions/stronks-d3008-firebase-adminsdk-fbsvc-82078f8515.json"
        )
      )
    );
    console.error(
      "- JSON-Datei existiert:",
      fs.existsSync(path.resolve(__dirname, "../web053.json"))
    );
  } finally {
    process.exit(0);
  }
}

batchImport();
