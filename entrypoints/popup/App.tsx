/**
 * Popup 主组件 - 配置页面
 */

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { sendToBackground } from '@/utils/message';
import './App.css';

type TabType = 'ai' | 'anki';

interface TestStatus {
  ai: 'idle' | 'testing' | 'success' | 'error';
  anki: 'idle' | 'testing' | 'success' | 'error';
}

export default function App() {
  const {
    baseUrl,
    apiKey,
    model,
    deckName,
    noteType,
    frontField,
    backField,
    setAIConfig,
    setAnkiConfig
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<TabType>('ai');
  const [testStatus, setTestStatus] = useState<TestStatus>({
    ai: 'idle',
    anki: 'idle'
  });

  // 本地表单状态
  const [formData, setFormData] = useState({
    baseUrl,
    apiKey,
    model,
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
      deckName,
      noteType,
      frontField,
      backField
    });
  }, [baseUrl, apiKey, model, deckName, noteType, frontField, backField]);

  // 更新表单字段
  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // 保存 AI 配置
  const saveAIConfig = () => {
    setAIConfig({
      baseUrl: formData.baseUrl,
      apiKey: formData.apiKey,
      model: formData.model
    });
  };

  // 保存 Anki 配置
  const saveAnkiConfig = () => {
    setAnkiConfig({
      deckName: formData.deckName,
      noteType: formData.noteType,
      frontField: formData.frontField,
      backField: formData.backField
    });
  };

  // 测试 AI 连接
  const testAIConnection = async () => {
    setTestStatus(prev => ({ ...prev, ai: 'testing' }));

    // 先保存配置
    saveAIConfig();

    // 将当前表单数据传递给 background 进行测试
    const response = await sendToBackground('TEST_AI_CONNECTION', {
      baseUrl: formData.baseUrl,
      apiKey: formData.apiKey
    });

    setTestStatus(prev => ({
      ...prev,
      ai: response.success ? 'success' : 'error'
    }));

    // 3秒后重置状态
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

    // 3秒后重置状态
    setTimeout(() => {
      setTestStatus(prev => ({ ...prev, anki: 'idle' }));
    }, 3000);
  };

  return (
    <div className="w-[360px] min-h-[400px] bg-gradient-to-br from-[#F0FDFA] to-[#CCFBF1] animate-fadeIn">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#0D9488] to-[#14B8A6] px-4 py-4 shadow-lg">
        <h1 className="text-lg font-bold text-white">面试鸭 Anki 助手</h1>
        <p className="text-xs text-white/90 mt-1">配置 AI 和 AnkiConnect</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 p-4 pb-0">
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
          Anki 配置
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
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
