/**
 * Zustand Store - 应用状态管理
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  AppConfig,
  DEFAULT_APP_CONFIG
} from '@/types';

interface AppState extends AppConfig {
  // 操作状态
  isLoading: boolean;
  lastError: string | null;

  // Actions
  setAIConfig: (config: Partial<Pick<AppConfig, 'baseUrl' | 'apiKey' | 'model'>>) => void;
  setAnkiConfig: (config: Partial<Pick<AppConfig, 'deckName' | 'noteType' | 'frontField' | 'backField'>>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetConfig: () => void;
}

// 默认配置
const defaultConfig: AppConfig = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  deckName: '面试鸭-八股文',
  noteType: 'Basic',
  frontField: 'Front',
  backField: 'Back'
};

// 自定义存储适配器，使用 chrome.storage.local
const chromeStorage = createJSONStorage(() => ({
  getItem: async (name: string): Promise<string | null> => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get(name);
      return result[name] ?? null;
    }
    // Fallback to localStorage for non-extension environment
    return localStorage.getItem(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ [name]: value });
    } else {
      localStorage.setItem(name, value);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.remove(name);
    } else {
      localStorage.removeItem(name);
    }
  }
}));

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // 初始状态
      ...defaultConfig,
      isLoading: false,
      lastError: null,

      // Actions
      setAIConfig: (config) =>
        set((state) => ({
          ...state,
          ...config
        })),

      setAnkiConfig: (config) =>
        set((state) => ({
          ...state,
          ...config
        })),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ lastError: error }),

      resetConfig: () => set({ ...defaultConfig, isLoading: false, lastError: null })
    }),
    {
      name: 'mianshiya-anki-config',
      storage: chromeStorage,
      partialize: (state) => ({
        // 只持久化配置，不持久化运行时状态
        baseUrl: state.baseUrl,
        apiKey: state.apiKey,
        model: state.model,
        deckName: state.deckName,
        noteType: state.noteType,
        frontField: state.frontField,
        backField: state.backField
      })
    }
  )
);

// 用于 background script 的非 hook 版本
export const getConfig = async (): Promise<AppConfig> => {
  const result = await chrome.storage.local.get('mianshiya-anki-config');
  const stored = result['mianshiya-anki-config'];

  if (stored?.state) {
    return {
      baseUrl: stored.state.baseUrl ?? defaultConfig.baseUrl,
      apiKey: stored.state.apiKey ?? defaultConfig.apiKey,
      model: stored.state.model ?? defaultConfig.model,
      deckName: stored.state.deckName ?? defaultConfig.deckName,
      noteType: stored.state.noteType ?? defaultConfig.noteType,
      frontField: stored.state.frontField ?? defaultConfig.frontField,
      backField: stored.state.backField ?? defaultConfig.backField
    };
  }

  return defaultConfig;
};

export const saveConfig = async (config: Partial<AppConfig>): Promise<void> => {
  const current = await getConfig();
  const updated = { ...current, ...config };
  await chrome.storage.local.set({
    'mianshiya-anki-config': {
      state: updated,
      version: 0
    }
  });
};
