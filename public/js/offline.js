class OfflineManager {
  constructor() {
    this.db = null;
    this.init();
  }

  async init() {
    this.db = await this.openDatabase();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.error("SW registration failed:", err));
    }
  }

  openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("POSDatabase", 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("pendingTransactions")) {
          db.createObjectStore("pendingTransactions", {
            keyPath: "id",
            autoIncrement: true,
          });
        }
        if (!db.objectStoreNames.contains("products")) {
          db.createObjectStore("products", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("auth")) {
          db.createObjectStore("auth", { keyPath: "key" });
        }
      };
    });
  }

  async savePendingTransaction(transaction) {
    const store = this.db
      .transaction("pendingTransactions", "readwrite")
      .objectStore("pendingTransactions");
    return new Promise((resolve, reject) => {
      const request = store.add(transaction);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getPendingTransactions() {
    const store = this.db
      .transaction("pendingTransactions", "readonly")
      .objectStore("pendingTransactions");
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async clearPendingTransaction(id) {
    const store = this.db
      .transaction("pendingTransactions", "readwrite")
      .objectStore("pendingTransactions");
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async cacheProducts(products) {
    const store = this.db
      .transaction("products", "readwrite")
      .objectStore("products");
    for (const product of products) {
      await new Promise((resolve, reject) => {
        const request = store.put(product);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    }
  }

  async getCachedProducts() {
    const store = this.db
      .transaction("products", "readonly")
      .objectStore("products");
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async saveAuthToken(key, value) {
    const store = this.db.transaction("auth", "readwrite").objectStore("auth");
    return new Promise((resolve, reject) => {
      const request = store.put({ key, value });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getAuthToken(key) {
    const store = this.db.transaction("auth", "readonly").objectStore("auth");
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result?.value);
    });
  }

  async syncPendingTransactions(accessToken) {
    const pendingTransactions = await this.getPendingTransactions();
    const synced = [];

    for (const txn of pendingTransactions) {
      try {
        const response = await fetch("/api/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(txn.data),
        });

        if (response.ok) {
          synced.push(txn.id);
        }
      } catch (error) {
        console.error("Failed to sync transaction:", txn.id, error);
      }
    }

    for (const id of synced) {
      await this.clearPendingTransaction(id);
    }

    return synced;
  }

  isOnline() {
    return navigator.onLine;
  }
}

const offlineManager = new OfflineManager();
