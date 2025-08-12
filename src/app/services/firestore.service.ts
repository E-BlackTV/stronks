import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  DocumentData,
  QuerySnapshot,
  DocumentSnapshot,
  Timestamp,
  writeBatch,
  serverTimestamp,
  setDoc
} from '@angular/fire/firestore';
import { Observable, from, map, BehaviorSubject, switchMap } from 'rxjs';

// Interfaces für die Datenstruktur
export interface Asset {
  id?: string;
  symbol: string;
  name: string;
  type: 'crypto' | 'stock' | 'forex';
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CachedData {
  id?: string;
  sourceId: string;     // Eindeutige ID der Datenquelle
  type: "crypto" | "stock" | "generic";  // Datentyp
  url: string;          // URL der ursprünglichen Datenquelle
  fetchedAt: Timestamp; // Zeitstempel des Abrufs
  rows: Array<{         // Array der Tabellendaten
    cells: string[];    // Jede Zeile enthält ein Array von Zellen
  }>;
}

export interface User {
  id?: string;
  email: string;
  displayName?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Portfolio {
  id?: string;
  userId: string;
  name: string;
  description?: string;
  assets: PortfolioAsset[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PortfolioAsset {
  assetId: string;
  symbol: string;
  quantity: number;
  averagePrice: number;
  addedAt: Timestamp;
}

/**
 * Firestore Service für die Frontend-Integration
 *
 * Best Practices:
 * 1. Verwende Observables für reaktive Daten
 * 2. Implementiere Error Handling
 * 3. Verwende TypeScript Interfaces für Typsicherheit
 * 4. Nutze Firestore Security Rules für Sicherheit
 * 5. Implementiere Pagination für große Datensätze
 */
@Injectable({
  providedIn: 'root'
})
export class FirestoreService {

  constructor(private firestore: Firestore) {}

  // ==================== ASSETS ====================

  /**
   * Alle Assets abrufen
   */
  getAssets(): Observable<Asset[]> {
    const assetsRef = collection(this.firestore, 'assets');
    const q = query(assetsRef, where('isActive', '==', true));

    return from(getDocs(q)).pipe(
      map((snapshot: QuerySnapshot<DocumentData>) =>
        snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Asset))
      )
    );
  }

  /**
   * Assets nach Typ filtern
   */
  getAssetsByType(type: 'crypto' | 'stock' | 'forex'): Observable<Asset[]> {
    const assetsRef = collection(this.firestore, 'assets');
    const q = query(
      assetsRef,
      where('type', '==', type),
      where('isActive', '==', true)
    );

    return from(getDocs(q)).pipe(
      map((snapshot: QuerySnapshot<DocumentData>) =>
        snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Asset))
      )
    );
  }

  /**
   * Einzelnes Asset abrufen
   */
  getAsset(id: string): Observable<Asset | null> {
    const assetRef = doc(this.firestore, 'assets', id);

    return from(getDoc(assetRef)).pipe(
      map((snapshot: DocumentSnapshot<DocumentData>) => {
        if (snapshot.exists()) {
          return {
            id: snapshot.id,
            ...snapshot.data()
          } as Asset;
        }
        return null;
      })
    );
  }

  /**
   * Asset erstellen
   */
  createAsset(asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Observable<string> {
    const assetsRef = collection(this.firestore, 'assets');
    const newAsset = {
      ...asset,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    return from(addDoc(assetsRef, newAsset)).pipe(
      map(docRef => docRef.id)
    );
  }

  /**
   * Asset aktualisieren
   */
  updateAsset(id: string, updates: Partial<Asset>): Observable<void> {
    const assetRef = doc(this.firestore, 'assets', id);
    const updateData = {
      ...updates,
      updatedAt: serverTimestamp()
    };

    return from(updateDoc(assetRef, updateData));
  }

  /**
   * Asset löschen (Soft Delete)
   */
  deleteAsset(id: string): Observable<void> {
    return this.updateAsset(id, { isActive: false });
  }

  // ==================== CACHED DATA ====================

  /**
   * Gecachte Daten abrufen
   */
  getCachedData(type?: "crypto" | "stock" | "generic", limitCount: number = 100): Observable<CachedData[]> {
    const cachedDataRef = collection(this.firestore, 'cached_data');

    // Verwende eine einfachere Abfrage ohne zusammengesetzten Index
    return from(getDocs(cachedDataRef)).pipe(
      map((snapshot: QuerySnapshot<DocumentData>) => {
        let allData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as CachedData));

        // Filtere nach Typ, falls angegeben
        if (type) {
          allData = allData.filter(data => data.type === type);
        }

        // Sortiere nach fetchedAt (neueste zuerst)
        allData.sort((a, b) => {
          const aTime = a.fetchedAt?.toMillis?.() || 0;
          const bTime = b.fetchedAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

        // Limitiere die Anzahl der Einträge
        return allData.slice(0, limitCount);
      })
    );
  }

  /**
   * Neueste gecachte Daten für einen bestimmten Typ
   */
  getLatestCachedData(type: "crypto" | "stock" | "generic"): Observable<CachedData[]> {
    const cachedDataRef = collection(this.firestore, 'cached_data');

    // Verwende eine einfachere Abfrage ohne zusammengesetzten Index
    return from(getDocs(cachedDataRef)).pipe(
      map((snapshot: QuerySnapshot<DocumentData>) => {
        const allData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as CachedData));

        // Filtere nach Typ und sortiere nach fetchedAt
        return allData
          .filter(data => data.type === type)
          .sort((a, b) => {
            const aTime = a.fetchedAt?.toMillis?.() || 0;
            const bTime = b.fetchedAt?.toMillis?.() || 0;
            return bTime - aTime; // Neueste zuerst
          })
          .slice(0, 50); // Limitiere auf 50 Einträge
      })
    );
  }

  /**
   * Gecachte Daten für eine spezifische Quelle abrufen
   */
  getCachedDataBySource(sourceId: string): Observable<CachedData | null> {
    const cachedDataRef = collection(this.firestore, 'cached_data');
    // Use only the where clause without orderBy to avoid needing a composite index
    const q = query(
      cachedDataRef,
      where('sourceId', '==', sourceId)
    );

    return from(getDocs(q)).pipe(
      map((snapshot: QuerySnapshot<DocumentData>) => {
        if (!snapshot.empty) {
          // Sort the documents in memory by fetchedAt
          const sortedDocs = snapshot.docs.sort((a, b) => {
            const aTime = a.data()['fetchedAt']?.toMillis?.() || 0;
            const bTime = b.data()['fetchedAt']?.toMillis?.() || 0;
            return bTime - aTime; // Newest first
          });

          const doc = sortedDocs[0]; // Get the newest document
          return {
            id: doc.id,
            ...doc.data()
          } as CachedData;
        }
        return null;
      })
    );
  }

  /** cached_data schreiben/aktualisieren */
  upsertCachedData(entry: { sourceId: string; type: "crypto" | "stock" | "generic"; url: string; rows: Array<{ cells: string[] }> }): Observable<void> {
    const { sourceId, type, url, rows } = entry;
    const cachedDataRef = collection(this.firestore, 'cached_data');
    // Use only the where clause without orderBy to avoid needing a composite index
    const q = query(
      cachedDataRef,
      where('sourceId', '==', sourceId)
    );
    return from(getDocs(q)).pipe(
      switchMap((snapshot: QuerySnapshot<DocumentData>) => {
        if (!snapshot.empty) {
          // Sort the documents in memory by fetchedAt
          const sortedDocs = snapshot.docs.sort((a, b) => {
            const aTime = a.data()['fetchedAt']?.toMillis?.() || 0;
            const bTime = b.data()['fetchedAt']?.toMillis?.() || 0;
            return bTime - aTime; // Newest first
          });

          const existing = sortedDocs[0]; // Get the newest document
          const ref = doc(this.firestore, 'cached_data', existing.id);
          return from(updateDoc(ref, {
            rows,
            url,
            type,
            fetchedAt: serverTimestamp(),
          })) as unknown as Observable<void>;
        }
        return from(addDoc(cachedDataRef, {
          sourceId,
          type,
          url,
          rows,
          createdAt: serverTimestamp(),
          fetchedAt: serverTimestamp(),
        })).pipe(map(() => void 0));
      })
    );
  }

  // ==================== PORTFOLIOS & USER BALANCE (ohne Functions) ====================

  /** Balance eines Users (users/{userId}.balance) */
  getUserBalance(userId: string): Observable<number> {
    const userRef = doc(this.firestore, 'users', userId);
    return from(getDoc(userRef)).pipe(
      map((snapshot: DocumentSnapshot<DocumentData>) => {
        const data = snapshot.data() as any;
        return data?.balance ?? 0;
      })
    );
  }

  /** Balance updaten */
  updateUserBalance(userId: string, newBalance: number): Observable<void> {
    const userRef = doc(this.firestore, 'users', userId);
    return from(updateDoc(userRef, { balance: newBalance, updatedAt: serverTimestamp() }));
  }

  /** Portfolio-Dokument (portfolios/{userId}) lesen */
  getPortfolioByUserId(userId: string): Observable<{ assets: any[] } | null> {
    const portfolioRef = doc(this.firestore, 'portfolios', userId);
    return from(getDoc(portfolioRef)).pipe(
      map((snapshot: DocumentSnapshot<DocumentData>) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as any;
          return { assets: data.assets ?? [] };
        }
        return { assets: [] };
      })
    );
  }

  /** Asset im Portfolio hinzufügen/aktualisieren (portfolios/{userId}) */
  upsertPortfolioAsset(params: {
    userId: string;
    symbol: string;
    quantityDelta: number; // positiv bei Kauf, negativ bei Verkauf
    amountDelta: number;   // investierter Betrag (+ beim Kauf, - beim Verkauf)
    currentPrice: number;
  }): Observable<void> {
    const { userId, symbol, quantityDelta, amountDelta, currentPrice } = params;
    const portfolioRef = doc(this.firestore, 'portfolios', userId);

    return from(getDoc(portfolioRef)).pipe(
      switchMap((snapshot: DocumentSnapshot<DocumentData>) => {
        let assets: any[] = [];
        if (snapshot.exists()) {
          const data = snapshot.data() as any;
          assets = Array.isArray(data.assets) ? [...data.assets] : [];
        }

        const indexOfAsset = assets.findIndex((a) => a.symbol === symbol);
        if (indexOfAsset >= 0) {
          const existing = { ...assets[indexOfAsset] };
          existing.quantity = (existing.quantity || 0) + quantityDelta;
          existing.totalInvested = (existing.totalInvested || 0) + amountDelta;
          existing.currentPrice = currentPrice;

          if (existing.quantity <= 0) {
            assets.splice(indexOfAsset, 1);
          } else {
            assets[indexOfAsset] = existing;
          }
        } else if (quantityDelta > 0) {
          assets.push({
            symbol,
            quantity: quantityDelta,
            totalInvested: amountDelta,
            currentPrice,
          });
        }

        return from(setDoc(portfolioRef, { userId, assets }, { merge: true })) as unknown as Observable<void>;
      })
    );
  }

  /** Portfolio-CashBalance setzen (portfolios/{userId}.cashBalance) */
  setPortfolioCashBalance(userId: string, cashBalance: number): Observable<void> {
    const portfolioRef = doc(this.firestore, 'portfolios', userId);
    return from(getDoc(portfolioRef)).pipe(
      switchMap((snapshot: DocumentSnapshot<DocumentData>) => {
        if (snapshot.exists()) {
          return from(updateDoc(portfolioRef, { cashBalance, updatedAt: serverTimestamp() })) as unknown as Observable<void>;
        }
        return from(setDoc(portfolioRef, {
          userId,
          assets: [],
          cashBalance,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })).pipe(map(() => void 0));
      })
    );
  }

  /** Transaktion protokollieren */
  addTransaction(entry: {
    userId: string;
    assetSymbol: string;
    quantity: number;
    amount: number;
    action: 'buy' | 'sell';
    currentPrice: number;
  }): Observable<string> {
    const txRef = collection(this.firestore, 'transactions');
    const docData = {
      ...entry,
      timestamp: serverTimestamp()
    };
    return from(addDoc(txRef, docData)).pipe(map((d) => d.id));
  }

  /** Transaktionsliste abrufen */
  getTransactions(userId: string, limitCount: number = 50): Observable<any[]> {
    const txRef = collection(this.firestore, 'transactions');
    const q = query(txRef, where('userId', '==', userId), orderBy('timestamp', 'desc'), limit(limitCount));
    return from(getDocs(q)).pipe(
      map((snapshot: QuerySnapshot<DocumentData>) =>
        snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      )
    );
  }

  /** Lucky Wheel: letzten Spin holen */
  getLastSpin(userId: string): Observable<{ lastSpinDate?: Timestamp } | null> {
    const ref = doc(this.firestore, 'luckyWheelSpins', userId);
    return from(getDoc(ref)).pipe(
      map((snap: DocumentSnapshot<DocumentData>) => {
        if (!snap.exists()) return null;
        const data = snap.data() as any;
        return { lastSpinDate: data?.lastSpinDate };
      })
    );
  }

  /** Lucky Wheel: Spin speichern */
  setLastSpin(userId: string, prizeAmount: number, prizePercentage: number): Observable<void> {
    const ref = doc(this.firestore, 'luckyWheelSpins', userId);
    const payload = {
      userId,
      prizeAmount,
      prizePercentage,
      lastSpinDate: serverTimestamp(),
    };
    return from(setDoc(ref, payload, { merge: true })) as unknown as Observable<void>;
  }

  // ==================== ECHTZEIT-UPDATES ====================

  /**
   * Echtzeit-Updates für Assets
   */
  getAssetsRealtime(): Observable<Asset[]> {
    const assetsRef = collection(this.firestore, 'assets');
    const q = query(assetsRef, where('isActive', '==', true));

    return new Observable(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const assets = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Asset));
        observer.next(assets);
      }, (error) => {
        observer.error(error);
      });

      return unsubscribe;
    });
  }

  /**
   * Echtzeit-Updates für ein einzelnes Asset
   */
  getAssetRealtime(id: string): Observable<Asset | null> {
    const assetRef = doc(this.firestore, 'assets', id);

    return new Observable(observer => {
      const unsubscribe = onSnapshot(assetRef, (snapshot) => {
        if (snapshot.exists()) {
          const asset = {
            id: snapshot.id,
            ...snapshot.data()
          } as Asset;
          observer.next(asset);
        } else {
          observer.next(null);
        }
      }, (error) => {
        observer.error(error);
      });

      return unsubscribe;
    });
  }

  // ==================== BATCH-OPERATIONEN ====================

  /**
   * Mehrere Assets in einem Batch erstellen
   */
  createAssetsBatch(assets: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>[]): Observable<void> {
    const batch = writeBatch(this.firestore);

    assets.forEach(asset => {
      const docRef = doc(collection(this.firestore, 'assets'));
      const newAsset = {
        ...asset,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      batch.set(docRef, newAsset);
    });

    return from(batch.commit());
  }

  // ==================== SUCHFUNKTIONEN ====================

  /**
   * Assets nach Symbol suchen
   */
  searchAssets(searchTerm: string): Observable<Asset[]> {
    const assetsRef = collection(this.firestore, 'assets');
    const q = query(
      assetsRef,
      where('symbol', '>=', searchTerm.toUpperCase()),
      where('symbol', '<=', searchTerm.toUpperCase() + '\uf8ff'),
      where('isActive', '==', true),
      limit(20)
    );

    return from(getDocs(q)).pipe(
      map((snapshot: QuerySnapshot<DocumentData>) =>
        snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Asset))
      )
    );
  }

  // ==================== STATISTIKEN ====================

  /**
   * Asset-Statistiken abrufen
   */
  getAssetStats(): Observable<{ total: number; byType: { [key: string]: number } }> {
    return this.getAssets().pipe(
      map(assets => {
        const byType = assets.reduce((acc, asset) => {
          acc[asset.type] = (acc[asset.type] || 0) + 1;
          return acc;
        }, {} as { [key: string]: number });

        return {
          total: assets.length,
          byType
        };
      })
    );
  }

  // ==================== ERROR HANDLING ====================

  /**
   * Wrapper für besseres Error Handling
   */
  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`Firestore ${operation} failed:`, error);
      // Hier könnte ein Error Service aufgerufen werden
      throw error;
    };
  }
}
