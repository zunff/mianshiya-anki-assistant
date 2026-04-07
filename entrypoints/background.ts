/**
 * Background Script - 后台脚本
 * 职责：消息中转、AI 调用、AnkiConnect 集成、配置管理
 */

import { defineBackground } from 'wxt/utils/define-background';
import type {
  AppConfig,
  QuestionData,
  AnkiCard,
  SaveToAnkiRequest,
  TestAIConnectionRequest,
  AnkiConnectResponse,
  MessageResponse,
  Message
} from '@/types';

// AI 精炼 Prompt
const AI_REFINE_PROMPT = `你是一位专业的 Java 面试八股文 Anki 卡片制作专家。
请把下面的面试题和解析精炼成高质量 Anki 卡片。

正面（Front）：题目原文（保持排版）
背面（Back）：核心知识点 + 标准答案 + 记忆要点 + 易错点（使用 Markdown，支持代码块）

输出必须是严格的 JSON 格式：
{
  "front": "...",
  "back": "...",
  "tags": ["Java", "JVM", "高频"]
}

根据内容自动生成 2-4 个标签。`;

// 从 chrome.storage.local 获取配置
async function getConfig(): Promise<AppConfig> {
  const defaultConfig: AppConfig = {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    deckName: '面试鸭-八股文',
    noteType: 'Basic',
    frontField: 'Front',
    backField: 'Back'
  };

  try {
    const result = await chrome.storage.local.get('mianshiya-anki-config');
    const rawValue = result['mianshiya-anki-config'];

    if (!rawValue) {
      return defaultConfig;
    }

    // Zustand persist 存储的是 JSON 字符串，需要解析
    const stored = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;

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
  } catch (error) {
    console.error('[Background] 读取配置失败:', error);
    return defaultConfig;
  }
}

// 调用 AI 接口进行精炼
async function callAI(config: AppConfig, content: string): Promise<AnkiCard> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: AI_REFINE_PROMPT },
        { role: 'user', content }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API 错误: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const messageContent = data.choices?.[0]?.message?.content;

  if (!messageContent) {
    throw new Error('AI 返回内容为空');
  }

  console.log('[Background] AI 原始响应:', messageContent);

  // 解析 JSON 响应
  try {
    // 尝试提取 JSON - 找到第一个 { 和最后一个 }
    const firstBrace = messageContent.indexOf('{');
    const lastBrace = messageContent.lastIndexOf('}');

    let jsonStr: string;
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = messageContent.slice(firstBrace, lastBrace + 1);
    } else {
      jsonStr = messageContent;
    }

    console.log('[Background] 待解析 JSON:', jsonStr);

    const card: AnkiCard = JSON.parse(jsonStr);

    if (!card.front || !card.back || !Array.isArray(card.tags)) {
      throw new Error('AI 返回的卡片格式不正确');
    }

    return card;
  } catch (parseError) {
    console.error('[Background] JSON 解析失败，原始响应:', messageContent);
    throw new Error(`解析 AI 响应失败: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
  }
}

// 调用 AnkiConnect 添加笔记
async function addToAnki(config: AppConfig, card: AnkiCard): Promise<number> {
  const response = await fetch('http://localhost:8765', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'addNote',
      version: 6,
      params: {
        note: {
          deckName: config.deckName,
          modelName: config.noteType,
          fields: {
            [config.frontField]: card.front,
            [config.backField]: card.back
          },
          tags: card.tags,
          options: {
            allowDuplicate: false
          }
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`AnkiConnect 请求失败: ${response.status}`);
  }

  const result: AnkiConnectResponse<number> = await response.json();

  if (result.error) {
    throw new Error(`AnkiConnect 错误: ${result.error}`);
  }

  return result.result as number;
}

// 测试 AI 连接
async function testAIConnection(config: AppConfig): Promise<boolean> {
  try {
    const response = await fetch(`${config.baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`
      }
    });
    return response.ok;
  } catch {
    return false;
  }
}

// 测试 AnkiConnect 连接
async function testAnkiConnection(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:8765', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'version',
        version: 6
      })
    });

    if (!response.ok) return false;

    const result: AnkiConnectResponse<number> = await response.json();
    return result.error === null;
  } catch {
    return false;
  }
}

// 完整的保存流程
async function saveToAnki(question: QuestionData): Promise<MessageResponse> {
  try {
    const config = await getConfig();
    console.log('[Background] 当前配置:', config);

    // 验证配置
    if (!config.apiKey) {
      return { success: false, error: '请先配置 AI API Key' };
    }

    // 构建要发送给 AI 的内容
    console.log('[Background] 爬取到的题目:', question.title);
    console.log('[Background] 爬取到的答案:', question.answer);

    const contentToRefine = `题目：${question.title}\n\n答案：${question.answer}`;

    // 调用 AI 精炼
    console.log('[Background] 正在调用 AI 精炼...');
    const card = await callAI(config, contentToRefine);
    console.log('[Background] AI 精炼完成:', card);

    // 添加到 Anki
    console.log('[Background] 正在添加到 Anki...');
    const noteId = await addToAnki(config, card);
    console.log('[Background] 添加成功, noteId:', noteId);

    return {
      success: true,
      data: { noteId, card }
    };
  } catch (error) {
    console.error('[Background] 保存失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// 导出 Background Script
export default defineBackground(() => {
  console.log('[Background] 面试鸭 Anki 助手已启动');

  // 监听消息
  chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
    const handleMessage = async () => {
      switch (message.type) {
        case 'SAVE_TO_ANKI': {
          const { question } = message.payload as SaveToAnkiRequest;
          return saveToAnki(question);
        }
        case 'GET_CONFIG': {
          const config = await getConfig();
          return { success: true, data: config };
        }
        case 'TEST_AI_CONNECTION': {
          const payload = message.payload as TestAIConnectionRequest | undefined;
          const config = payload ? { baseUrl: payload.baseUrl, apiKey: payload.apiKey } : await getConfig();
          const connected = await testAIConnection(config as AppConfig);
          return { success: connected, error: connected ? undefined : 'AI 连接失败，请检查配置' };
        }
        case 'TEST_ANKI_CONNECTION': {
          const connected = await testAnkiConnection();
          return { success: connected, error: connected ? undefined : 'AnkiConnect 连接失败，请确保 Anki 已启动且 AnkiConnect 插件已安装' };
        }
        default:
          return { success: false, error: `Unknown message type: ${message.type}` };
      }
    };

    handleMessage().then(sendResponse);
    return true; // 保持消息通道打开
  });
});
