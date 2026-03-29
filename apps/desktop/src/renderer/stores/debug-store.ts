/**
 * Debug Store
 * ===========
 *
 * Manages debug panel visibility and settings.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DebugStore {
  // Panel visibility
  isDebugPanelVisible: boolean;
  setDebugPanelVisible: (visible: boolean) => void;
  toggleDebugPanel: () => void;

  // Debug settings
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  setLogLevel: (level: 'debug' | 'info' | 'warn' | 'error') => void;

  autoScroll: boolean;
  setAutoScroll: (enabled: boolean) => void;

  // Filter settings
  filter: 'all' | 'errors' | 'tools' | 'lifecycle';
  setFilter: (filter: 'all' | 'errors' | 'tools' | 'lifecycle') => void;
}

export const useDebugStore = create<DebugStore>()(
  persist(
    (set) => ({
      isDebugPanelVisible: false,
      setDebugPanelVisible: (visible) => set({ isDebugPanelVisible: visible }),
      toggleDebugPanel: () => set((state) => ({ isDebugPanelVisible: !state.isDebugPanelVisible })),

      logLevel: 'info',
      setLogLevel: (level) => set({ logLevel: level }),

      autoScroll: true,
      setAutoScroll: (enabled) => set({ autoScroll: enabled }),

      filter: 'all',
      setFilter: (filter) => set({ filter }),
    }),
    {
      name: 'debug-storage',
    }
  )
);
