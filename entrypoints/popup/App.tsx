/**
 * Popup 主组件 - 配置页面
 */

import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { sendToBackground } from '@/utils/message';
import type { Task } from '@/types';
import './App.css';

type TabType = 'tasks' | 'ai' | 'anki';

interface TestStatus {
  ai: 'idle' | 'testing' | 'success' | 'error';
  anki: 'idle' | 'testing' | 'success' | 'error';
}

export default function App() {
  const {
    baseUrl,
    apiKey,
    model,
    ankiHost,
    ankiPort,
    deckName,
    noteType,
    frontField,
    backField,
    setAIConfig,
    setAnkiConfig
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<TabType>('tasks');
  const [testStatus, setTestStatus] = useState<TestStatus>({
    ai: 'idle',
    anki: 'idle'
  });
  const [tasks, setTasks] = useState<Record<string, Task>>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // 本地表单状态
  const [formData, setFormData] = useState({
    baseUrl,
    apiKey,
    model,
    ankiHost,
    ankiPort,
    deckName,
    noteType,
    frontField,
    backField
  });

  // 保存原始配置用于比较
  const originalConfigRef = useRef({
    baseUrl,
    apiKey,
    model,
    ankiHost,
    ankiPort,
    deckName,
    noteType,
    frontField,
    backField
  });

  // 同步 store 到本地状态
  useEffect(() => {
    setFormData({
      baseUrl,
      apiKey,
      model,
      ankiHost,
      ankiPort,
      deckName,
      noteType,
      frontField,
      backField
    });
    originalConfigRef.current = {
      baseUrl,
      apiKey,
      model,
      ankiHost,
      ankiPort,
      deckName,
      noteType,
      frontField,
      backField
    };
  }, [baseUrl, apiKey, model, ankiHost, ankiPort, deckName, noteType, frontField, backField]);

  // 检查配置是否有变化
  const hasConfigChanged = () => {
    const original = originalConfigRef.current;
    return (
      formData.baseUrl !== original.baseUrl ||
      formData.apiKey !== original.apiKey ||
      formData.model !== original.model ||
      formData.ankiHost !== original.ankiHost ||
      formData.ankiPort !== original.ankiPort ||
      formData.deckName !== original.deckName ||
      formData.noteType !== original.noteType ||
      formData.frontField !== original.frontField ||
      formData.backField !== original.backField
    );
  };

  // 自动保存配置
  const autoSaveConfig = () => {
    if (!hasConfigChanged()) return;

    setAIConfig({
      baseUrl: formData.baseUrl,
      apiKey: formData.apiKey,
      model: formData.model
    });
    setAnkiConfig({
      ankiHost: formData.ankiHost,
      ankiPort: formData.ankiPort,
      deckName: formData.deckName,
      noteType: formData.noteType,
      frontField: formData.frontField,
      backField: formData.backField
    });

    // 更新原始配置引用
    originalConfigRef.current = { ...formData };
  };

  // popup 关闭时自动保存
  useEffect(() => {
    const handleUnload = () => {
      autoSaveConfig();
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [formData]);

  // 监听任务变化
  useEffect(() => {
    const loadTasks = async () => {
      const response = await sendToBackground('GET_TASKS');
      if (response.success && response.data) {
        setTasks(response.data as Record<string, Task>);
      }
    };

    loadTasks();

    // 监听 storage 变化
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes['mianshiya-anki-tasks']) {
        setTasks(changes['mianshiya-anki-tasks'].newValue || {});
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // 更新表单字段
  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // 显示保存成功提示
  const showSaveMessage = (msg: string) => {
    setSaveMessage(msg);
    setTimeout(() => setSaveMessage(null), 2000);
  };

  // 保存 AI 配置
  const saveAIConfig = () => {
    setAIConfig({
      baseUrl: formData.baseUrl,
      apiKey: formData.apiKey,
      model: formData.model
    });
    originalConfigRef.current = { ...originalConfigRef.current, baseUrl: formData.baseUrl, apiKey: formData.apiKey, model: formData.model };
    showSaveMessage('AI 配置已保存');
  };

  // 保存 Anki 配置
  const saveAnkiConfig = () => {
    setAnkiConfig({
      ankiHost: formData.ankiHost,
      ankiPort: formData.ankiPort,
      deckName: formData.deckName,
      noteType: formData.noteType,
      frontField: formData.frontField,
      backField: formData.backField
    });
    originalConfigRef.current = { ...originalConfigRef.current, ankiHost: formData.ankiHost, ankiPort: formData.ankiPort, deckName: formData.deckName, noteType: formData.noteType, frontField: formData.frontField, backField: formData.backField };
    showSaveMessage('Anki 配置已保存');
  };

  // 清空已收集题目缓存
  const clearCollectedCache = async () => {
    const response = await sendToBackground('CLEAR_COLLECTED_CACHE');
    if (response.success) {
      alert('已清空浏览器缓存的已收集题目');
    }
  };

  // 测试 AI 连接
  const testAIConnection = async () => {
    setTestStatus(prev => ({ ...prev, ai: 'testing' }));

    saveAIConfig();

    const response = await sendToBackground('TEST_AI_CONNECTION', {
      baseUrl: formData.baseUrl,
      apiKey: formData.apiKey
    });

    setTestStatus(prev => ({
      ...prev,
      ai: response.success ? 'success' : 'error'
    }));

    setTimeout(() => {
      setTestStatus(prev => ({ ...prev, ai: 'idle' }));
    }, 3000);
  };

  // 测试 AnkiConnect 连接
  const testAnkiConnection = async () => {
    setTestStatus(prev => ({ ...prev, anki: 'testing' }));

    const response = await sendToBackground('TEST_ANKI_CONNECTION');

    setTestStatus(prev => ({
      ...prev,
      anki: response.success ? 'success' : 'error'
    }));

    setTimeout(() => {
      setTestStatus(prev => ({ ...prev, anki: 'idle' }));
    }, 3000);
  };

  const taskList = Object.values(tasks);

  return (
    <div className="w-[360px] min-h-[400px] bg-gradient-to-br from-[#F0FDFA] to-[#CCFBF1] animate-fadeIn">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#0D9488] to-[#14B8A6] px-4 py-4 shadow-lg relative">
        <h1 className="text-lg font-bold text-white">面试鸭 Anki 助手</h1>
        <p className="text-xs text-white/90 mt-1">配置 AI 和 AnkiConnect</p>
        {/* 保存成功提示 */}
        {saveMessage && (
          <div className="absolute top-2 right-4 bg-green-500 text-white text-xs px-3 py-1 rounded-full shadow-md animate-fadeIn">
            {saveMessage}
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="flex gap-1 p-4 pb-0">
        <button
          className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'tasks'
              ? 'tab-active'
              : 'bg-white/60 text-[#0F766E] hover:bg-white/80'
          }`}
          onClick={() => setActiveTab('tasks')}
        >
          任务 {taskList.length > 0 && `(${taskList.length})`}
        </button>
        <button
          className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'ai'
              ? 'tab-active'
              : 'bg-white/60 text-[#0F766E] hover:bg-white/80'
          }`}
          onClick={() => setActiveTab('ai')}
        >
          AI 配置
        </button>
        <button
          className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'anki'
              ? 'tab-active'
              : 'bg-white/60 text-[#0F766E] hover:bg-white/80'
          }`}
          onClick={() => setActiveTab('anki')}
        >
          Anki
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'tasks' && (
          <div className="space-y-3 bg-white rounded-xl p-4 shadow-sm border-2 border-[#99F6E4]/30 min-h-[200px]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#0F766E]">进行中的任务</p>
              <button
                className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors border border-red-200"
                onClick={clearCollectedCache}
                title="清空浏览器缓存的已收集题目记录"
              >
                清空缓存
              </button>
            </div>

            {taskList.length === 0 ? (
              <div className="text-center py-8 text-[#0F766E]/60">
                <p className="text-sm">暂无进行中的任务</p>
                <p className="text-xs mt-2">访问 mianshiya.com 题目页面点击按钮添加</p>
              </div>
            ) : (
              <div className="space-y-3">
                {taskList.map((task) => (
                  <div
                    key={task.title}
                    className="p-3 rounded-lg bg-[#F0FDFA] border border-[#99F6E4]/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0F766E] truncate" title={task.title}>
                          {task.title}
                        </p>
                        <p className="text-xs text-[#0F766E]/70 mt-1">{task.progress}</p>
                      </div>
                      {task.status === 'processing' && (
                        <div className="flex items-center gap-2">
                          <button
                            className="text-xs px-2 py-1 rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                            onClick={async () => {
                              await sendToBackground('CANCEL_TASK', { title: task.title });
                            }}
                          >
                            取消
                          </button>
                          <div className="w-4 h-4 border-2 border-[#14B8A6] border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                      {task.status === 'error' && (
                        <button
                          className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                          onClick={async () => {
                            await sendToBackground('CANCEL_TASK', { title: task.title });
                          }}
                        >
                          移除
                        </button>
                      )}
                    </div>
                    {task.error && (
                      <p className="text-xs text-red-500 mt-2 break-all">{task.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-4 bg-white rounded-xl p-4 shadow-sm border-2 border-[#99F6E4]/30">
            {/* Base URL */}
            <div className="form-group">
              <label className="form-label">API Base URL</label>
              <input
                type="url"
                className="form-input"
                placeholder="https://api.openai.com/v1"
                value={formData.baseUrl}
                onChange={(e) => updateField('baseUrl', e.target.value)}
              />
              <p className="form-hint">支持 OpenAI 兼容接口</p>
            </div>

            {/* API Key */}
            <div className="form-group">
              <label className="form-label">API Key</label>
              <input
                type="password"
                className="form-input"
                placeholder="sk-..."
                value={formData.apiKey}
                onChange={(e) => updateField('apiKey', e.target.value)}
              />
            </div>

            {/* Model */}
            <div className="form-group">
              <label className="form-label">模型</label>
              <input
                type="text"
                className="form-input"
                placeholder="gpt-4o-mini"
                value={formData.model}
                onChange={(e) => updateField('model', e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                className="btn-primary flex-1"
                onClick={saveAIConfig}
              >
                保存配置
              </button>
              <button
                className={`btn-secondary ${
                  testStatus.ai === 'success' ? 'btn-success' :
                  testStatus.ai === 'error' ? 'btn-error' : ''
                }`}
                onClick={testAIConnection}
                disabled={testStatus.ai === 'testing'}
              >
                {testStatus.ai === 'testing' && '测试中...'}
                {testStatus.ai === 'idle' && '测试连接'}
                {testStatus.ai === 'success' && '✓ 成功'}
                {testStatus.ai === 'error' && '✗ 失败'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'anki' && (
          <div className="space-y-4 bg-white rounded-xl p-4 shadow-sm border-2 border-[#99F6E4]/30">
            {/* AnkiConnect 连接配置 */}
            <p className="text-sm font-semibold text-[#0F766E]">AnkiConnect 连接</p>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
              <div className="form-group mb-0">
                <label className="form-label">Host</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="localhost"
                  value={formData.ankiHost}
                  onChange={(e) => updateField('ankiHost', e.target.value)}
                />
              </div>
              <span className="pb-3 text-[#0F766E] font-semibold">:</span>
              <div className="form-group mb-0">
                <label className="form-label">端口</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="8765"
                  value={formData.ankiPort}
                  onChange={(e) => updateField('ankiPort', e.target.value)}
                />
              </div>
            </div>

            <div className="divider" />

            {/* Deck Name */}
            <div className="form-group">
              <label className="form-label">牌组名称</label>
              <input
                type="text"
                className="form-input"
                placeholder="面试鸭-八股文"
                value={formData.deckName}
                onChange={(e) => updateField('deckName', e.target.value)}
              />
            </div>

            {/* Note Type */}
            <div className="form-group">
              <label className="form-label">笔记类型</label>
              <input
                type="text"
                className="form-input"
                placeholder="Basic"
                value={formData.noteType}
                onChange={(e) => updateField('noteType', e.target.value)}
              />
            </div>

            <div className="divider" />

            {/* Field Mapping */}
            <p className="text-sm font-semibold text-[#0F766E]">字段映射</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="form-label">正面字段</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Front"
                  value={formData.frontField}
                  onChange={(e) => updateField('frontField', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">背面字段</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Back"
                  value={formData.backField}
                  onChange={(e) => updateField('backField', e.target.value)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                className="btn-primary flex-1"
                onClick={saveAnkiConfig}
              >
                保存配置
              </button>
              <button
                className={`btn-secondary ${
                  testStatus.anki === 'success' ? 'btn-success' :
                  testStatus.anki === 'error' ? 'btn-error' : ''
                }`}
                onClick={testAnkiConnection}
                disabled={testStatus.anki === 'testing'}
              >
                {testStatus.anki === 'testing' && '测试中...'}
                {testStatus.anki === 'idle' && '测试连接'}
                {testStatus.anki === 'success' && '✓ 成功'}
                {testStatus.anki === 'error' && '✗ 失败'}
              </button>
            </div>

            {/* AnkiConnect 提示 */}
            <div className="hint-card">
              <p className="font-semibold text-[#0F766E] mb-2 text-sm">使用说明：</p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-[#134E4A]">
                <li>确保 Anki 已启动</li>
                <li>安装 AnkiConnect 插件（代码：2055492159）</li>
                <li>AnkiConnect 默认端口：8765</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="px-4 py-3 text-center">
        <p className="text-xs text-[#0F766E]/70">访问 mianshiya.com 题目页面即可使用</p>
      </footer>
    </div>
  );
}
