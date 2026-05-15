/**
 * Background Script - 后台脚本
 * 职责：消息中转、AI 调用、AnkiConnect 集成、配置管理、异步任务
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
  Message,
  Task,
  STORAGE_KEYS
} from '@/types';

const STORAGE_KEY = {
  CONFIG: 'mianshiya-anki-config',
  TASKS: 'mianshiya-anki-tasks',
  COLLECTED: 'mianshiya-anki-collected'
} as const;

// Service Worker 保活配置
const TASK_ALARM_NAME = 'mianshiya-task-keepalive';
const TASK_ALARM_INTERVAL_MINUTES = 0.4; // 约25秒，确保在 Chrome 30秒超时前唤醒

// AI 精炼 Prompt
const AI_REFINE_PROMPT = `你是"面试八股 Anki 制卡器"。目标：把【题目 + 解析原文】拆成适合长期记忆的"自适应原子化卡组"。

## 输入
我会给你：
- question：面试题
- material：原文解析/笔记（可能很长）

## 输出格式（必须严格 JSON；不得输出任何多余文字）
返回一个对象，字段固定：
{
  "cards": [
    { "front": "...", "back": "...", "tags": ["...", "..."] }
  ]
}

## 总体结构
- 先输出 M 张基础卡，再输出 N 张追问卡
- M = 1~3，建议 1~2
- N = 0~5，建议 2~4
- 总卡数不得超过 8

## 基础卡的目标
基础卡负责讲清：
1) 核心结论：是什么 / 为什么 / 核心区别 / 适用场景
2) 结构骨架：分类 / 流程 / 组成 / 对比维度

## 基础卡拆分规则
### 默认不拆
满足任一即可视为适合 1 张基础卡：
- 骨架要点 <= 5 条
- 30 秒内能口述完
- 如果基础卡内容要点 <= 5 条，且核心结论 + 结构骨架总字数 <= 80，则必须强制只生成 1 张基础卡，不得拆分

### 触发拆分
满足任一即可拆成 2~3 张基础卡：
- 骨架要点 > 7 条
- 存在 2 个及以上并列子主题
- 同时跨越 2 个及以上层次（例如：定义 / 流程 / 异常场景）

### 拆分原则
- 能 1 张说清就不要拆
- 拆分后的多张基础卡必须正交，不得重复
- 优先按以下两种方式拆：
  - 按层次拆：是什么/为什么、结构/流程、边界/对比
  - 按子主题拆：子主题 A、子主题 B、子主题 C

## 基础卡 front 规则
- 如果只生成 1 张基础卡：front 直接使用题目原文
- 如果生成多张基础卡：front 使用 "{题目} - {层次或子主题}"
- front 必须是纯文本，不要输出 HTML

## 基础卡 back 规则
- 必须使用 HTML
- 只能使用：<h3> <p> <ol> <ul> <li> <strong> <code>
- 必须包含两个小标题，顺序固定：
  - <h3>核心结论</h3>
  - <h3>结构骨架</h3>
- 每张基础卡 back 最多 7 条要点
- 结构骨架里的并列要点，默认优先使用 <ol><li> 输出，尽量形成 1. 2. 3. 4. 的编号结构
- 只有当内容明显不适合编号时，才使用 <ul><li>
- 基础卡禁止出现具体追问 Q&A

## 追问卡的目标
- 每张追问卡只考 1 个问题 + 1 个答案
- 只保留高频 / 易错 / 边界 / 面试常追问的点
- 如果材料中没有明确的追问点，可以输出 0 张追问卡
- 追问点不足时，不要为了凑到建议数量而强行生成追问卡；宁可少出，也不要硬凑

## 追问卡 front 规则
- 固定格式：
  【追问】{原题目}

  Q：{追问问题}
- front 必须是纯文本，不要输出 HTML

## 追问卡 back 规则
- 必须使用 HTML
- 只能使用：<h3> <p> <ol> <ul> <li> <strong> <code>
- 必须包含两个小标题，顺序固定：
  - <h3>追问</h3>
  - <h3>答案</h3>
- 答案尽量控制在 1~2 句，够答面试即可
- 追问卡内容禁止与基础卡骨架重复，必须是额外考察点

## 内容原则（强约束）
- 极简：只保留可检索关键词，避免长文
- 无代码：不输出代码块/示例代码
- 不编造：只基于 material；不确定写"原文未提及"
- 面试导向：优先区分点、边界、适用场景、代价、最佳实践
- 术语规范：类名/关键字用 <code> 标注；重点用 <strong>

## 标签规则
- 每张卡 2~3 个 tags
- 同一道题的所有卡 tags 必须一致
- tags 从 question/material 抽取，不超过 3 个

## 输出示例 1：简单题（1 张基础卡 + 2 张追问卡）
{
  "cards": [
    {
      "front": "transient 关键字有什么作用？",
      "back": "<h3>核心结论</h3><p><strong>transient</strong> 用于让字段在序列化时被忽略，避免不该持久化的数据进入字节流。</p><h3>结构骨架</h3><ol><li>作用：阻止字段被序列化</li><li>场景：敏感信息 / 临时状态</li><li>边界：只影响序列化结果，不影响对象本身</li></ol>",
      "tags": ["Java","序列化","八股"]
    },
    {
      "front": "【追问】transient 关键字有什么作用？\\n\\nQ：static 字段还需要加 transient 吗？",
      "back": "<h3>追问</h3><p>static 字段还需要加 transient 吗？</p><h3>答案</h3><p>通常不需要，因为 <code>static</code> 属于类，本来就不参与对象序列化。</p>",
      "tags": ["Java","序列化","八股"]
    },
    {
      "front": "【追问】transient 关键字有什么作用？\\n\\nQ：transient 常用于什么字段？",
      "back": "<h3>追问</h3><p>transient 常用于什么字段？</p><h3>答案</h3><p>常用于密码、token、缓存值、运行时临时状态等不应落盘或传输的数据。</p>",
      "tags": ["Java","序列化","八股"]
    }
  ]
}

## 输出示例 2：复杂题（2 张基础卡 + 3 张追问卡）
{
  "cards": [
    {
      "front": "Java 集合体系 - List 体系",
      "back": "<h3>核心结论</h3><p><strong>List</strong> 是有序、可重复的集合体系，重点在顺序和随机访问/插入删除特性。</p><h3>结构骨架</h3><ol><li><code>ArrayList</code>：数组，查询快</li><li><code>LinkedList</code>：链表，插删灵活</li><li>关注点：顺序、重复、扩容、遍历代价</li></ol>",
      "tags": ["Java","集合","八股"]
    },
    {
      "front": "Java 集合体系 - Map 体系",
      "back": "<h3>核心结论</h3><p><strong>Map</strong> 以键值对存储数据，重点在键唯一、查找效率和有序性差异。</p><h3>结构骨架</h3><ol><li><code>HashMap</code>：无序，通用</li><li><code>LinkedHashMap</code>：保持插入顺序</li><li><code>TreeMap</code>：可排序</li><li>关注点：哈希、顺序、红黑树、线程安全</li></ol>",
      "tags": ["Java","集合","八股"]
    },
    {
      "front": "【追问】Java 集合体系\\n\\nQ：ArrayList 和 LinkedList 怎么选？",
      "back": "<h3>追问</h3><p><code>ArrayList</code> 和 <code>LinkedList</code> 怎么选？</p><h3>答案</h3><p>读多查多优先 <code>ArrayList</code>；中间频繁插删且明确受益时再考虑 <code>LinkedList</code>。</p>",
      "tags": ["Java","集合","八股"]
    },
    {
      "front": "【追问】Java 集合体系\\n\\nQ：HashMap 为什么查询通常快？",
      "back": "<h3>追问</h3><p><code>HashMap</code> 为什么查询通常快？</p><h3>答案</h3><p>因为先通过 hash 快速定位桶位，再在桶内查找；冲突严重时性能会下降。</p>",
      "tags": ["Java","集合","八股"]
    },
    {
      "front": "【追问】Java 集合体系\\n\\nQ：需要有序遍历时为什么不直接都用 TreeMap？",
      "back": "<h3>追问</h3><p>需要有序遍历时为什么不直接都用 <code>TreeMap</code>？</p><h3>答案</h3><p><code>TreeMap</code> 为维护排序要付出更高操作代价，只有确实需要按 key 排序时才值得用。</p>",
      "tags": ["Java","集合","八股"]
    }
  ]
}

## 最终检查清单
- 输出必须是严格 JSON
- 基础卡在前，追问卡在后
- 基础卡 1~3 张，追问卡 0~5 张，总数 <= 8
- 简单题不要滥拆，复杂题不要硬塞一张
- 同一信息不要跨卡重复
- 结构骨架优先用 <ol><li>，让要点按 1. 2. 3. 4. 编号展示
- front 一律纯文本；HTML 只出现在 back
`;


// ============ 配置管理 ============

async function getConfig(): Promise<AppConfig> {
  const defaultConfig: AppConfig = {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    ankiHost: 'localhost',
    ankiPort: '8765',
    deckName: '面试鸭-八股文',
    noteType: 'Basic',
    frontField: 'Front',
    backField: 'Back'
  };

  try {
    const result = await chrome.storage.local.get(STORAGE_KEY.CONFIG);
    const rawValue = result[STORAGE_KEY.CONFIG];

    if (!rawValue) {
      return defaultConfig;
    }

    const stored = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;

    if (stored?.state) {
      return {
        baseUrl: stored.state.baseUrl ?? defaultConfig.baseUrl,
        apiKey: stored.state.apiKey ?? defaultConfig.apiKey,
        model: stored.state.model ?? defaultConfig.model,
        ankiHost: stored.state.ankiHost ?? defaultConfig.ankiHost,
        ankiPort: stored.state.ankiPort ?? defaultConfig.ankiPort,
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

// ============ 已收集题目管理 ============

// 获取 AnkiConnect URL
function getAnkiUrl(config: AppConfig): string {
  return `http://${config.ankiHost}:${config.ankiPort}`;
}

// 生成题目标识 tag（去掉所有空格）
function generateQuestionTag(title: string): string {
  return title.replace(/\s+/g, '');
}

async function getCollectedTitles(): Promise<Set<string>> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY.COLLECTED);
    const titles = result[STORAGE_KEY.COLLECTED] || [];
    return new Set(titles);
  } catch {
    return new Set();
  }
}

async function markAsCollected(title: string): Promise<void> {
  const normalizedTitle = title.replace(/\s+/g, '');
  const collected = await getCollectedTitles();
  collected.add(normalizedTitle);
  await chrome.storage.local.set({ [STORAGE_KEY.COLLECTED]: Array.from(collected) });
}

// 通过 Anki tag 检查是否已收集（保底方案）
async function checkAnkiByTag(tag: string, config: AppConfig): Promise<boolean> {
  try {
    const response = await fetch(getAnkiUrl(config), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'findNotes',
        version: 6,
        params: {
          query: `tag:"${tag}"`
        }
      })
    });

    const result: AnkiConnectResponse<number[]> = await response.json();
    return result.result !== null && result.result.length > 0;
  } catch {
    return false;
  }
}

// 双重检查：本地缓存 + Anki tag
async function isCollected(title: string, config: AppConfig): Promise<boolean> {
  // 去掉所有空格作为唯一标识
  const normalizedTitle = title.replace(/\s+/g, '');

  // 1. 先查本地缓存（快速）
  const localCollected = await getCollectedTitles();
  if (localCollected.has(normalizedTitle)) {
    return true;
  }

  // 2. 再查 Anki tag（保底，跨设备同步）
  return await checkAnkiByTag(normalizedTitle, config);
}

// ============ 任务管理 ============

async function getTasks(): Promise<Record<string, Task>> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY.TASKS);
    return result[STORAGE_KEY.TASKS] || {};
  } catch {
    return {};
  }
}

async function setTask(title: string, task: Task): Promise<void> {
  const tasks = await getTasks();
  tasks[title] = task;
  await chrome.storage.local.set({ [STORAGE_KEY.TASKS]: tasks });
}

async function removeTask(title: string): Promise<void> {
  const tasks = await getTasks();
  delete tasks[title];
  await chrome.storage.local.set({ [STORAGE_KEY.TASKS]: tasks });
}

// ============ AI 调用 ============

async function callAI(
  config: AppConfig,
  question: string,
  content: string,
  signal?: AbortSignal
): Promise<AIRefineResult> {
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
    }),
    signal
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

// ============ AnkiConnect ============

async function addToAnki(config: AppConfig, card: AnkiCard, questionTag: string): Promise<number> {
  // 在原有 tags 基础上添加题目标识 tag
  const finalTags = [...card.tags, questionTag];

  const response = await fetch(getAnkiUrl(config), {
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
          tags: finalTags,
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

// ============ 连接测试 ============

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

async function testAnkiConnection(config: AppConfig): Promise<boolean> {
  try {
    const response = await fetch(getAnkiUrl(config), {
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

// ============ Service Worker 保活 ============

async function startTaskKeepalive(): Promise<void> {
  await chrome.alarms.create(TASK_ALARM_NAME, {
    delayInMinutes: TASK_ALARM_INTERVAL_MINUTES,
    periodInMinutes: TASK_ALARM_INTERVAL_MINUTES
  });
  console.log('[Background] 任务保活 alarm 已启动');
}

async function stopTaskKeepalive(): Promise<void> {
  await chrome.alarms.clear(TASK_ALARM_NAME);
  console.log('[Background] 任务保活 alarm 已停止');
}

async function checkAndStopKeepalive(): Promise<void> {
  const tasks = await getTasks();
  const hasProcessing = Object.values(tasks).some(t => t.status === 'processing');
  if (!hasProcessing) {
    await stopTaskKeepalive();
  }
}

// 恢复中断的任务（Service Worker 重启后）
async function recoverTasks(): Promise<void> {
  const tasks = await getTasks();
  const processingTasks = Object.values(tasks).filter(
    t => t.status === 'processing' && t.question
  );

  if (processingTasks.length === 0) return;

  console.log('[Background] 发现中断的任务，正在恢复:', processingTasks.length);

  for (const task of processingTasks) {
    executeTask(task.question!);
  }

  await startTaskKeepalive();
}

// ============ 异步任务执行 ============

// 存储进行中任务的 AbortController
const taskAbortControllers = new Map<string, AbortController>();

async function executeTask(question: QuestionData): Promise<void> {
  const title = question.title.trim();

  // 创建 AbortController 用于取消
  const abortController = new AbortController();
  taskAbortControllers.set(title, abortController);

  // 启动保活机制
  await startTaskKeepalive();

  try {
    const config = await getConfig();

    // 检查是否已取消
    if (abortController.signal.aborted) {
      throw new Error('任务已取消');
    }

    if (!config.apiKey) {
      await setTask(title, {
        title,
        url: question.url,
        status: 'error',
        progress: '配置错误',
        error: '请先配置 AI API Key'
      });
      return;
    }

    // AI 精炼（保存 question 数据用于恢复）
    await setTask(title, {
      title,
      url: question.url,
      status: 'processing',
      progress: 'AI 精炼中...',
      question  // 保存原始数据，Service Worker 重启后可恢复
    });

    console.log('[Background] 正在调用 AI 精炼...');
    const refineResult = await callAI(config, question.title, question.answer, abortController.signal);
    console.log('[Background] AI 精炼完成，生成', refineResult.cards.length, '张卡片');

    // 检查是否已取消
    if (abortController.signal.aborted) {
      throw new Error('任务已取消');
    }

    // 添加到 Anki
    const questionTag = generateQuestionTag(title);
    const noteIds: number[] = [];
    for (let i = 0; i < refineResult.cards.length; i++) {
      // 检查是否已取消
      if (abortController.signal.aborted) {
        throw new Error('任务已取消');
      }

      await setTask(title, {
        title,
        url: question.url,
        status: 'processing',
        progress: `添加卡片 ${i + 1}/${refineResult.cards.length}`,
        question
      });

      const noteId = await addToAnki(config, refineResult.cards[i], questionTag);
      noteIds.push(noteId);
    }

    console.log('[Background] 添加成功, noteIds:', noteIds);

    // 标记为已收集并移除任务
    await markAsCollected(title);
    await removeTask(title);

  } catch (error) {
    // 如果是取消导致的错误，直接移除任务
    if (error instanceof Error && error.message === '任务已取消') {
      console.log('[Background] 任务已取消:', title);
      await removeTask(title);
      return;
    }

    console.error('[Background] 任务执行失败:', error);
    await setTask(title, {
      title,
      url: question.url,
      status: 'error',
      progress: '执行失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    taskAbortControllers.delete(title);
    await checkAndStopKeepalive();
  }
}

// ============ Background Script 入口 ============

export default defineBackground(() => {
  console.log('[Background] 面试鸭 Anki 助手已启动');

  // 启动时恢复中断的任务
  recoverTasks();

  // 监听 alarm，保持 Service Worker 存活
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === TASK_ALARM_NAME) {
      const tasks = await getTasks();
      const hasProcessing = Object.values(tasks).some(t => t.status === 'processing');
      if (!hasProcessing) {
        await stopTaskKeepalive();
      } else {
        console.log('[Background] 保活 alarm 触发，仍有任务处理中');
      }
    }
  });

  chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
    const handleMessage = async () => {
      switch (message.type) {
        case 'START_TASK': {
          const { question } = message.payload as SaveToAnkiRequest;
          const title = question.title.trim();
          const config = await getConfig();

          // 检查是否已收集
          if (await isCollected(title, config)) {
            return { success: true, data: { duplicate: true } };
          }

          // 检查是否已有进行中的任务
          const tasks = await getTasks();
          if (tasks[title]) {
            return { success: true, data: { duplicate: false, started: false, reason: '任务已存在' } };
          }

          // 创建任务并异步执行
          await setTask(title, {
            title,
            url: question.url,
            status: 'processing',
            progress: '准备中...',
            question  // 保存原始数据，用于 Service Worker 重启后恢复
          });

          // 异步执行任务（不等待）
          executeTask(question);

          return { success: true, data: { duplicate: false, started: true } };
        }

        case 'GET_TASKS': {
          const tasks = await getTasks();
          return { success: true, data: tasks };
        }

        case 'CANCEL_TASK': {
          const { title } = message.payload as { title: string };
          const abortController = taskAbortControllers.get(title);
          if (abortController) {
            abortController.abort();
          }
          await removeTask(title);
          return { success: true };
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
          const config = await getConfig();
          const connected = await testAnkiConnection(config);
          return { success: connected, error: connected ? undefined : 'AnkiConnect 连接失败，请确保 Anki 已启动且 AnkiConnect 插件已安装' };
        }

        case 'CLEAR_COLLECTED_CACHE': {
          await chrome.storage.local.remove(STORAGE_KEY.COLLECTED);
          return { success: true };
        }

        default:
          return { success: false, error: `Unknown message type: ${message.type}` };
      }
    };

    handleMessage().then(sendResponse);
    return true;
  });
});
