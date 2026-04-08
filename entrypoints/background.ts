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
  TestAIConnectionRequest,
  AnkiConnectResponse,
  MessageResponse,
  Message
} from '@/types';

// AI 精炼 Prompt
const AI_REFINE_PROMPT = `你是“面试八股 Anki 制卡器”。目标：把【题目+解析原文】拆成“3+1”卡组，便于 30~60 秒口述与复习。

## 输入
我会给你：
- question：面试题
- material：原文解析/笔记（可能很长）

## 输出格式（必须严格 JSON；不得输出任何多余文字）
返回一个对象，包含 4 张卡（3+1），字段固定为 front/back/tags：
{
  "cards": [
    { "front": "...", "back": "...", "tags": ["...", "..."] },
    { "front": "...", "back": "...", "tags": ["...", "..."] },
    { "front": "...", "back": "...", "tags": ["...", "..."] },
    { "front": "...", "back": "...", "tags": ["...", "..."] }
  ]
}

## 3+1 卡片定义（顺序固定）
1) 核心结论卡：1~2 句话讲清“是什么 + 核心区别/目的”
2) 结构框架卡：用“总-分”骨架列出分类/流程/组成/对比维度（只保留框架词）
3) 高频追问&坑卡：面试常追问点 + 易错点（用 Q→A 超短句）
4) 口述总卡（30~60 秒）：给“口述顺序模板”，用关键词把前三张串起来（不是长文）

## 内容原则（强约束）
- 极简：只保留“可检索关键词”；每张卡 back 最多 7 条要点
- 无代码：不输出代码块/示例代码
- 不编造：只基于 material；不确定写“原文未提及”
- 面试导向：优先“区分点/边界/适用场景/代价/最佳实践”
- 术语规范：类名/关键字用 <code> 标注；重点用 <strong>

## HTML 规则
- back 字段使用 HTML，且只能使用：<h3> <p> <ul> <li> <strong> <code>
- 禁止使用：<br>、表格、图片、Markdown
- front 字段用纯文本（允许少量符号如“Q：”和“•”）

## 小标题规范（back 必须按卡类型输出）
- 核心结论卡：<h3>核心结论</h3>
- 结构框架卡：<h3>结构框架</h3>
- 追问&坑卡：<h3>高频追问&坑</h3>
- 口述总卡：<h3>30-60秒口述</h3> + <h3>关键词</h3>

## 关键要求：追问&坑卡的 front 也要列出所有 Q
- 追问&坑卡 front：
  - 第一行固定： "【追问&坑】{question}"
  - 下面用项目符号列出所有问题（只写 Q，不写 A），顺序与 back 一致
  - 每条以 "Q：" 开头
- 追问&坑卡 back：
  - 仍输出 Q + A（每条一行，尽量短）
  - 最多 6 条（挑最高频；不要超过）

## 标签规则
- 每张卡 2~3 个 tags
- 同一道题（四张卡）tags 必须一致
- tags 从 question/material 抽取，不超过 3 个

## 输出示例（仅示例；真实输出必须根据输入生成）
{
  "cards": [
    {
      "front": "【核心结论】序列化是什么？一句话说明",
      "back": "<h3>核心结论</h3><ul><li><strong>序列化</strong>：对象 → 字节流（存储/传输）</li><li><strong>反序列化</strong>：字节流 → 对象</li></ul>",
      "tags": ["Java","序列化","八股"]
    },
    {
      "front": "【结构框架】序列化相关要点分哪几块？",
      "back": "<h3>结构框架</h3><ul><li>接口：<code>Serializable</code>（标记）</li><li>版本：<code>serialVersionUID</code></li><li>字段：<code>transient</code> / static</li><li>继承：父类是否可序列化</li></ul>",
      "tags": ["Java","序列化","八股"]
    },
    {
      "front": "【追问&坑】序列化面试常追问哪些点？\\n• Q：static 会序列化吗？\\n• Q：不写 <code>serialVersionUID</code> 会怎样？\\n• Q：父类未实现 <code>Serializable</code> 会怎样？",
      "back": "<h3>高频追问&坑</h3><ul><li>Q：static 会序列化吗？A：不会（属于类）</li><li>Q：不写 <code>serialVersionUID</code>？A：版本变更易失败</li><li>Q：父类未实现接口？A：原文未提及则标注</li></ul>",
      "tags": ["Java","序列化","八股"]
    },
    {
      "front": "【口述总卡】请用 30-60 秒讲清序列化",
      "back": "<h3>30-60秒口述</h3><ul><li>先定义：序列化/反序列化</li><li>再讲用途：存储/网络传输</li><li>再讲关键点：接口、UID、transient/static</li><li>最后给注意：版本兼容/安全风险（原文未提及则不写）</li></ul><h3>关键词</h3><ul><li><code>Serializable</code></li><li><code>serialVersionUID</code></li><li><code>transient</code></li></ul>",
      "tags": ["Java","序列化","八股"]
    }
  ]
}`;


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
async function callAI(config: AppConfig, question: string, content: string): Promise<AIRefineResult> {
  const userContent = `question: ${question}\n\nmaterial: ${content}`;

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
        { role: 'user', content: userContent }
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

    if (!result.cards || !Array.isArray(result.cards)) {
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

    console.log('[Background] 正在调用 AI 精炼...');
    const refineResult = await callAI(config, question.title, question.answer);
    console.log('[Background] AI 精炼完成，生成', refineResult.cards.length, '张卡片');

    const noteIds: number[] = [];
    for (const card of refineResult.cards) {
      console.log('[Background] 正在添加卡片:', card.front.substring(0, 30) + '...');
      const noteId = await addToAnki(config, card);
      noteIds.push(noteId);
    }

    console.log('[Background] 添加成功, noteIds:', noteIds);

    return {
      success: true,
      data: { noteIds, cards: refineResult.cards }
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
