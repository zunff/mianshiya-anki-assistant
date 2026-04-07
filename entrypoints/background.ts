/**
 * Background Script - 后台脚本
 * 职责：消息中转、AI 调用、AnkiConnect 集成、配置管理
 */

import { defineBackground } from 'wxt/utils/define-background';
import type {
  AppConfig,
  QuestionData,
  AnkiCard,
  AIRefineResult,
  SaveToAnkiRequest,
  CheckDuplicateRequest,
  DeleteNotesRequest,
  TestAIConnectionRequest,
  AnkiConnectResponse,
  MessageResponse,
  Message
} from '@/types';

// AI 精炼 Prompt
const AI_REFINE_PROMPT = `你是 Anki 卡片制作专家。把面试题解析精炼成记忆卡片。

## 输出格式
严格的 JSON，back 字段使用 HTML 格式：
{
  "back": "...",
  "tags": ["Java", "高频"]
}

## 内容原则
- **极简**: 只保留关键词和核心概念，不做详细解释
- **无代码**: 不需要代码示例
- **抓重点**: 突出记忆线索，细节查看原文

## HTML 标签规范
- <h3> 章节标题（如"核心概念"、"三要素"）
- <p> 段落说明
- <ul><li> 要点列表
- <strong> 加粗关键词
- <code> 标注类名/方法名/关键字

## 示例输出
{
  "back": "<h3>核心概念</h3><ul><li>序列化：对象 → 字节流（存硬盘/网络传输）</li><li>反序列化：字节流 → 对象</li></ul><h3>三要素</h3><ul><li>实现 <code>Serializable</code> 接口（标记接口）</li><li><code>transient</code> 修饰敏感字段（不参与序列化）</li><li>定义 <code>serialVersionUID</code>（版本戳，防冲突）</li></ul><h3>注意点</h3><ul><li>静态变量不参与序列化（属于类）</li><li>父类未实现 <code>Serializable</code> 则父类字段不序列化</li></ul>",
  "tags": ["Java", "序列化", "基础"]
}

根据内容生成 2-3 个标签。`;

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
async function callAI(config: AppConfig, content: string): Promise<AIRefineResult> {
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

  try {
    const firstBrace = messageContent.indexOf('{');
    const lastBrace = messageContent.lastIndexOf('}');

    let jsonStr: string;
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = messageContent.slice(firstBrace, lastBrace + 1);
    } else {
      jsonStr = messageContent;
    }

    const result: AIRefineResult = JSON.parse(jsonStr);

    if (!result.back || !Array.isArray(result.tags)) {
      throw new Error('AI 返回的卡片格式不正确');
    }

    return result;
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

// 查找重复卡片
async function findDuplicateNotes(
  deckName: string,
  frontField: string,
  title: string
): Promise<number[]> {
  const query = `"deck:${deckName}" "${frontField}:${title}"`;
  
  const response = await fetch('http://localhost:8765', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'findNotes',
      version: 6,
      params: {
        query
      }
    })
  });

  if (!response.ok) {
    throw new Error(`AnkiConnect 请求失败: ${response.status}`);
  }

  const result: AnkiConnectResponse<number[]> = await response.json();

  if (result.error) {
    throw new Error(`AnkiConnect 错误: ${result.error}`);
  }

  return result.result || [];
}

// 删除卡片
async function deleteNotes(noteIds: number[]): Promise<void> {
  const response = await fetch('http://localhost:8765', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'deleteNotes',
      version: 6,
      params: {
        notes: noteIds
      }
    })
  });

  if (!response.ok) {
    throw new Error(`AnkiConnect 请求失败: ${response.status}`);
  }

  const result: AnkiConnectResponse<null> = await response.json();

  if (result.error) {
    throw new Error(`AnkiConnect 错误: ${result.error}`);
  }
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

    if (!config.apiKey) {
      return { success: false, error: '请先配置 AI API Key' };
    }

    const contentToRefine = `答案：${question.answer}`;

    console.log('[Background] 正在调用 AI 精炼...');
    const refineResult = await callAI(config, contentToRefine);
    console.log('[Background] AI 精炼完成');

    const card: AnkiCard = {
      front: question.title,
      back: refineResult.back,
      tags: refineResult.tags
    };

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
        case 'CHECK_DUPLICATE': {
          const payload = message.payload as CheckDuplicateRequest;
          try {
            const noteIds = await findDuplicateNotes(
              payload.deckName,
              payload.frontField,
              payload.title
            );
            return { 
              success: true, 
              data: { 
                hasDuplicate: noteIds.length > 0, 
                noteIds 
              } 
            };
          } catch (error) {
            return { 
              success: false, 
              error: error instanceof Error ? error.message : '检查重复失败' 
            };
          }
        }
        case 'DELETE_NOTES': {
          const payload = message.payload as DeleteNotesRequest;
          try {
            await deleteNotes(payload.noteIds);
            return { success: true };
          } catch (error) {
            return { 
              success: false, 
              error: error instanceof Error ? error.message : '删除卡片失败' 
            };
          }
        }
        default:
          return { success: false, error: `Unknown message type: ${message.type}` };
      }
    };

    handleMessage().then(sendResponse);
    return true; // 保持消息通道打开
  });
});
