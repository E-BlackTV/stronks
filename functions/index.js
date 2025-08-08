const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();

const db = admin.firestore();

// Trading Functions
exports.executeTrade = functions.https.onCall(async (data, context) => {
  // Authentifizierung prüfen
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  const { userId, assetSymbol, quantity, amount, currentPrice, action } = data;

  try {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "User not found");
    }

    const userData = userDoc.data();
    const currentBalance = userData.balance || 0;

    if (action === "buy") {
      if (currentBalance < amount) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Insufficient balance"
        );
      }

      // Transaktion ausführen
      await db.runTransaction(async (transaction) => {
        // Balance aktualisieren
        transaction.update(userRef, {
          balance: currentBalance - amount,
        });

        // Portfolio-Eintrag hinzufügen/aktualisieren
        const portfolioRef = db.collection("portfolios").doc(userId);
        const portfolioDoc = await transaction.get(portfolioRef);

        if (portfolioDoc.exists) {
          const portfolio = portfolioDoc.data();
          const existingAsset = portfolio.assets?.find(
            (a) => a.symbol === assetSymbol
          );

          if (existingAsset) {
            existingAsset.quantity += quantity;
            existingAsset.totalInvested += amount;
          } else {
            portfolio.assets = [
              ...(portfolio.assets || []),
              {
                symbol: assetSymbol,
                quantity: quantity,
                totalInvested: amount,
                currentPrice: currentPrice,
              },
            ];
          }
          transaction.set(portfolioRef, portfolio);
        } else {
          transaction.set(portfolioRef, {
            userId: userId,
            assets: [
              {
                symbol: assetSymbol,
                quantity: quantity,
                totalInvested: amount,
                currentPrice: currentPrice,
              },
            ],
          });
        }

        // Transaktion loggen
        const transactionRef = db.collection("transactions").doc();
        transaction.set(transactionRef, {
          userId: userId,
          assetSymbol: assetSymbol,
          quantity: quantity,
          amount: amount,
          action: "buy",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          currentPrice: currentPrice,
        });
      });

      return { success: true, message: "Buy order executed successfully" };
    } else if (action === "sell") {
      // Verkauf-Logik implementieren
      return { success: true, message: "Sell order executed successfully" };
    }
  } catch (error) {
    console.error("Trade execution error:", error);
    throw new functions.https.HttpsError("internal", "Trade execution failed");
  }
});

// Portfolio abrufen
exports.getPortfolio = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  const { userId } = data;

  try {
    const portfolioRef = db.collection("portfolios").doc(userId);
    const portfolioDoc = await portfolioRef.get();

    if (!portfolioDoc.exists) {
      return { success: true, assets: [], totalValue: 0 };
    }

    const portfolio = portfolioDoc.data();
    return { success: true, ...portfolio };
  } catch (error) {
    console.error("Get portfolio error:", error);
    throw new functions.https.HttpsError("internal", "Failed to get portfolio");
  }
});

// Account Balance abrufen
exports.getBalance = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  const { userId } = data;

  try {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "User not found");
    }

    const userData = userDoc.data();
    return { success: true, balance: userData.balance || 0 };
  } catch (error) {
    console.error("Get balance error:", error);
    throw new functions.https.HttpsError("internal", "Failed to get balance");
  }
});

// Asset-Preis abrufen (von externer API)
exports.getAssetPrice = functions.https.onCall(async (data, context) => {
  const { symbol } = data;

  try {
    // Yahoo Finance API verwenden
    const response = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=5m`
    );

    if (response.data && response.data.chart && response.data.chart.result) {
      const result = response.data.chart.result[0];
      const prices = result.indicators?.quote[0]?.close || [];
      const currentPrice = prices[prices.length - 1];

      return { success: true, price: currentPrice, symbol: symbol };
    } else {
      throw new functions.https.HttpsError(
        "not-found",
        "Price data not available"
      );
    }
  } catch (error) {
    console.error("Get asset price error:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Failed to get asset price"
    );
  }
});

// Lucky Wheel
exports.spinLuckyWheel = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  const { userId } = data;

  try {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "User not found");
    }

    const userData = userDoc.data();
    const currentBalance = userData.balance || 0;

    // Prüfen ob User heute schon gespielt hat
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastSpinRef = db.collection("luckyWheelSpins").doc(userId);
    const lastSpinDoc = await lastSpinRef.get();

    if (lastSpinDoc.exists) {
      const lastSpin = lastSpinDoc.data();
      const lastSpinDate = lastSpin.lastSpinDate.toDate();
      lastSpinDate.setHours(0, 0, 0, 0);

      if (lastSpinDate.getTime() === today.getTime()) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Already spun today"
        );
      }
    }

    // Gewinn berechnen (1-10% des aktuellen Vermögens)
    const prizePercentage = Math.random() * 9 + 1; // 1-10%
    const prizeAmount = Math.round((currentBalance * prizePercentage) / 100);

    // Gewinn hinzufügen und Spin speichern
    await db.runTransaction(async (transaction) => {
      transaction.update(userRef, {
        balance: currentBalance + prizeAmount,
      });

      transaction.set(lastSpinRef, {
        userId: userId,
        lastSpinDate: admin.firestore.FieldValue.serverTimestamp(),
        prizeAmount: prizeAmount,
        prizePercentage: prizePercentage,
      });
    });

    return {
      success: true,
      prizeAmount: prizeAmount,
      prizePercentage: prizePercentage,
      newBalance: currentBalance + prizeAmount,
    };
  } catch (error) {
    console.error("Lucky wheel error:", error);
    throw new functions.https.HttpsError("internal", "Lucky wheel spin failed");
  }
});

// Transaktionshistorie abrufen
exports.getTransactions = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  const { userId, limit = 50, offset = 0 } = data;

  try {
    const transactionsRef = db
      .collection("transactions")
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc")
      .limit(limit)
      .offset(offset);

    const snapshot = await transactionsRef.get();
    const transactions = [];

    snapshot.forEach((doc) => {
      transactions.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return { success: true, transactions: transactions };
  } catch (error) {
    console.error("Get transactions error:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Failed to get transactions"
    );
  }
});

// Chart-Daten abrufen (Proxy für Yahoo)
exports.getChartData = functions.https.onCall(async (data, context) => {
  const { symbol, range = "1d", interval = "5m" } = data;
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}`;
    const response = await axios.get(url, { timeout: 10000 });
    return response.data;
  } catch (error) {
    console.error("Get chart data error:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Failed to get chart data"
    );
  }
});
