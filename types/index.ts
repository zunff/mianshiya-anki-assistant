/**
 * 面试鸭 Anki 助手 - 类型定义
 */

// ============ AI 配置 ============

export interface AIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

// ============ AnkiConnect 配置 ============

export interface AnkiConfig {
  deckName: string;
  noteType: string;
  frontField: string;
  backField: string;
}

// ============ 应用配置（合并） ============

export interface AppConfig extends AIConfig, AnkiConfig {
  // 可以添加其他全局配置
}

// ============ 默认配置 ============

export const DEFAULT_AI_CONFIG: AIConfig = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini'
};

export const DEFAULT_ANKI_CONFIG: AnkiConfig = {
  deckName: '面试鸭-八股文',
  noteType: 'Basic',
  frontField: 'Front',
  backField: 'Back'
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  ...DEFAULT_AI_CONFIG,
  ...DEFAULT_ANKI_CONFIG
};

// ============ Anki 卡片 ============

export interface AnkiCard {
  front: string;
  back: string;
  tags: string[];
}

export interface AIRefineResult {
  back: string;
  tags: string[];
}

// ============ 题目数据 ============

export interface QuestionData {
  title: string;
  answer: string;
  url: string;
}

// ============ 消息类型 ============

export type MessageType =
  | 'SAVE_TO_ANKI'
  | 'AI_REFINE'
  | 'ANKI_ADD_NOTE'
  | 'TEST_AI_CONNECTION'
  | 'TEST_ANKI_CONNECTION'
  | 'GET_CONFIG'
  | 'SAVE_CONFIG';

export interface TestAIConnectionRequest {
  baseUrl: string;
  apiKey: string;
}

export interface Message<T = unknown> {
  type: MessageType;
  payload?: T;
}

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============ 保存到 Anki 的请求 ============

export interface SaveToAnkiRequest {
  question: QuestionData;
}

export interface SaveToAnkiResponse {
  success: boolean;
  error?: string;
}

// ============ AI 精炼请求/响应 ============

export interface AIRefineRequest {
  content: string;
}

export interface AIRefineResponse {
  card: AnkiCard;
}

// ============ AnkiConnect API ============

export interface AnkiConnectRequest<T = unknown> {
  action: string;
  version: number;
  params: T;
}

export interface AnkiConnectResponse<T = unknown> {
  result: T | null;
  error: string | null;
}

export interface AnkiAddNoteParams {
  note: {
    deckName: string;
    modelName: string;
    fields: Record<string, string>;
    tags: string[];
    options?: {
      allowDuplicate?: boolean;
      duplicateScope?: string;
      duplicateScopeOptions?: {
        deckName?: string;
        checkChildren?: boolean;
        checkAllModels?: boolean;
      };
    };
  };
}

// ============ Toast 消息 ============

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  type: ToastType;
  message: string;
  duration?: number;
}
