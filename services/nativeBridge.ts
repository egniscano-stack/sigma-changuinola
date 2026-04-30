/**
 * SIGMA Changuinola - Native Bridge for Capacitor (Android/iOS)
 * 
 * Provides the same backup/restore API as Electron's preload.cjs
 * but uses Capacitor's Preferences plugin (native SharedPreferences on Android).
 * 
 * This ensures the app works identically on Desktop (Electron) and Mobile (Capacitor).
 */

import { Preferences } from '@capacitor/preferences';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

// ============================================================
// DETECTION: Are we running inside Capacitor (Android/iOS)?
// ============================================================
export const isCapacitorNative = (): boolean => {
  return Capacitor.isNativePlatform();
};

export const isElectron = (): boolean => {
  return !!(window as any).electronAPI;
};

export const isDesktopOrMobile = (): boolean => {
  return isElectron() || isCapacitorNative();
};

// ============================================================
// BACKUP API: Compatible with Electron's window.electronAPI.backup
// ============================================================
export const nativeBackup = {
  /**
   * Save data to native storage (SharedPreferences on Android)
   * Stores JSON-serialized data under key `sigma_backup_{key}`
   */
  save: async (key: string, data: any): Promise<{ success: boolean; error?: string }> => {
    try {
      const serialized = JSON.stringify(data);
      await Preferences.set({
        key: `sigma_backup_${key}`,
        value: serialized,
      });
      return { success: true };
    } catch (e: any) {
      console.error('[NativeBridge] Save error:', e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Load data from native storage
   * Returns parsed JSON data or null if not found
   */
  load: async (key: string): Promise<{ success: boolean; data: any; error?: string }> => {
    try {
      const result = await Preferences.get({ key: `sigma_backup_${key}` });
      if (result.value) {
        return { success: true, data: JSON.parse(result.value) };
      }
      return { success: true, data: null };
    } catch (e: any) {
      console.error('[NativeBridge] Load error:', e);
      return { success: false, data: null, error: e.message };
    }
  },

  /**
   * Remove a specific backup key
   */
  remove: async (key: string): Promise<void> => {
    await Preferences.remove({ key: `sigma_backup_${key}` });
  },

  /**
   * Clear all SIGMA backups from storage
   */
  clearAll: async (): Promise<void> => {
    const keys = await Preferences.keys();
    for (const key of keys.keys) {
      if (key.startsWith('sigma_backup_')) {
        await Preferences.remove({ key });
      }
    }
  },
};

// ============================================================
// NETWORK: Cross-platform online/offline detection
// ============================================================
export const nativeNetwork = {
  /**
   * Get current network status
   */
  getStatus: async (): Promise<boolean> => {
    if (isCapacitorNative()) {
      const status = await Network.getStatus();
      return status.connected;
    }
    return navigator.onLine;
  },

  /**
   * Listen for network changes (returns cleanup function)
   */
  onStatusChange: (callback: (isOnline: boolean) => void): (() => void) => {
    if (isCapacitorNative()) {
      const handler = Network.addListener('networkStatusChange', (status) => {
        callback(status.connected);
      });
      return () => {
        handler.then(h => h.remove());
      };
    }
    
    // Fallback for web/Electron
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  },
};

// ============================================================
// SYNC QUEUE: "Store and Forward" for Offline Operations
// ============================================================
export interface SyncItem {
  id: string;
  type: 'TRANSACTION' | 'ADMIN_REQUEST' | 'TAXPAYER_UPDATE';
  data: any;
  timestamp: string;
}

export const nativeSync = {
  /**
   * Add an item to the pending sync queue
   */
  queueItem: async (type: SyncItem['type'], data: any): Promise<void> => {
    try {
      const { data: currentQueue } = await nativeBackup.load('sync_queue');
      const queue: SyncItem[] = currentQueue || [];
      
      const newItem: SyncItem = {
        id: `SYNC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type,
        data,
        timestamp: new Date().toISOString(),
      };
      
      queue.push(newItem);
      await nativeBackup.save('sync_queue', queue);
      console.log(`[SyncEngine] Item queued for later: ${type} (${newItem.id})`);
    } catch (e) {
      console.error('[SyncEngine] Error queuing item:', e);
    }
  },

  /**
   * Get all pending items
   */
  getQueue: async (): Promise<SyncItem[]> => {
    const { data } = await nativeBackup.load('sync_queue');
    return data || [];
  },

  /**
   * Remove a processed item from the queue
   */
  removeItem: async (id: string): Promise<void> => {
    const queue = await nativeSync.getQueue();
    const newQueue = queue.filter(item => item.id !== id);
    await nativeBackup.save('sync_queue', newQueue);
  },
};

// ============================================================
// UNIFIED API: Expose same interface as Electron for App.tsx
// ============================================================
export const initializeNativeBridge = () => {
  if (isCapacitorNative() && !(window as any).electronAPI) {
    // Create a compatible API on window so App.tsx code works unchanged
    (window as any).capacitorAPI = {
      backup: nativeBackup,
      sync: nativeSync,
      network: nativeNetwork,
      isNative: true,
      platform: Capacitor.getPlatform(), // 'android' | 'ios' | 'web'
    };
    console.log('[NativeBridge] Capacitor Native Bridge initialized for', Capacitor.getPlatform());
  }
};
