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
  symbol: string;
  rangePeriod: string;
  intervalPeriod: string;
  data: any;
  type: string;
  lastUpdated: Timestamp;
  createdAt: Timestamp;
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
   * Cached Data für ein Symbol abrufen
   */
  getCachedData(symbol: string, rangePeriod?: string, intervalPeriod?: string): Observable<CachedData[]> {
    const cachedDataRef = collection(this.firestore, 'cached_data');
    let q = query(cachedDataRef, where('symbol', '==', symbol));
    
    if (rangePeriod) {
      q = query(q, where('rangePeriod', '==', rangePeriod));
    }
    if (intervalPeriod) {
      q = query(q, where('intervalPeriod', '==', intervalPeriod));
    }
    
    q = query(q, orderBy('lastUpdated', 'desc'), limit(10));
    
    return from(getDocs(q)).pipe(
      map((snapshot: QuerySnapshot<DocumentData>) => 
        snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as CachedData))
      )
    );
  }

  /**
   * Neueste Cached Data für ein Symbol
   */
  getLatestCachedData(symbol: string, rangePeriod: string, intervalPeriod: string): Observable<CachedData | null> {
    const cachedDataRef = collection(this.firestore, 'cached_data');
    const q = query(
      cachedDataRef,
      where('symbol', '==', symbol),
      where('rangePeriod', '==', rangePeriod),
      where('intervalPeriod', '==', intervalPeriod),
      orderBy('lastUpdated', 'desc'),
      limit(1)
    );
    
    return from(getDocs(q)).pipe(
      map((snapshot: QuerySnapshot<DocumentData>) => {
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
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
  upsertCachedData(entry: { symbol: string; rangePeriod: string; intervalPeriod: string; data: any; type?: string }): Observable<void> {
    const { symbol, rangePeriod, intervalPeriod, data, type } = entry;
    const cachedDataRef = collection(this.firestore, 'cached_data');
    const q = query(
      cachedDataRef,
      where('symbol', '==', symbol),
      where('rangePeriod', '==', rangePeriod),
      where('intervalPeriod', '==', intervalPeriod),
      orderBy('lastUpdated', 'desc'),
      limit(1)
    );
    return from(getDocs(q)).pipe(
      switchMap((snapshot: QuerySnapshot<DocumentData>) => {
        if (!snapshot.empty) {
          const existing = snapshot.docs[0];
          const ref = doc(this.firestore, 'cached_data', existing.id);
          const existingData = existing.data() as any;
          return from(updateDoc(ref, {
            data,
            type: type ?? existingData['type'] ?? 'chart',
            lastUpdated: serverTimestamp(),
          })) as unknown as Observable<void>;
        }
        return from(addDoc(cachedDataRef, {
          symbol,
          rangePeriod,
          intervalPeriod,
          data,
          type: type ?? 'chart',
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp(),
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