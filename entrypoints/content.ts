/**
 * Content Script - 面试鸭页面内容脚本
 * 职责：注入悬浮按钮、抓取页面内容、显示提示
 */

import { defineContentScript } from 'wxt/utils/define-content-script';
import type { QuestionData, ToastMessage, Message, MessageResponse, SaveToAnkiRequest } from '@/types';

// 导出 Content Script
export default defineContentScript({
  matches: ['https://mianshiya.com/*'],
  runAt: 'document_idle',

  main() {
    console.log('[Content] 面试鸭 Anki 助手已加载');

    // 选择器配置
    const SELECTORS = {
      question: 'h1.ant-typography',
      answer: '.ant-card-body .markdown-body'
    };

    // Toast 样式
    const TOAST_STYLES = `
      .mianshiya-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 999999;
        animation: slideIn 0.3s ease-out;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        max-width: 320px;
      }

      .mianshiya-toast.success {
        background: #10b981;
        color: white;
      }

      .mianshiya-toast.error {
        background: #ef4444;
        color: white;
      }

      .mianshiya-toast.info {
        background: #3b82f6;
        color: white;
      }

      .mianshiya-toast.warning {
        background: #f59e0b;
        color: white;
      }

      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;

    // 悬浮按钮样式
    const BUTTON_STYLES = `
      .mianshiya-float-btn {
        position: fixed;
        right: 24px;
        bottom: 24px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: none;
        cursor: pointer;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        transition: all 0.3s ease;
        color: white;
        font-size: 24px;
      }

      .mianshiya-float-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
      }

      .mianshiya-float-btn:active {
        transform: scale(0.95);
      }

      .mianshiya-float-btn.loading {
        pointer-events: none;
        opacity: 0.7;
      }

      .mianshiya-float-btn.loading .mianshiya-spinner {
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      .mianshiya-btn-tooltip {
        position: absolute;
        right: 70px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 13px;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
      }

      .mianshiya-float-btn:hover .mianshiya-btn-tooltip {
        opacity: 1;
      }
    `;

    // 发送消息到 Background
    async function sendToBackground<T = unknown, R = unknown>(
      type: string,
      payload?: T
    ): Promise<MessageResponse<R>> {
      try {
        const message: Message<T> = { type: type as never, payload };
        const response = await chrome.runtime.sendMessage(message);
        return response as MessageResponse<R>;
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // 注入样式
    function injectStyles(): void {
      const style = document.createElement('style');
      style.id = 'mianshiya-anki-styles';
      style.textContent = TOAST_STYLES + BUTTON_STYLES;
      document.head.appendChild(style);
    }

    // 显示 Toast 提示
    function showToast(message: ToastMessage): void {
      // 移除已有的 toast
      const existingToast = document.querySelector('.mianshiya-toast');
      if (existingToast) {
        existingToast.remove();
      }

      const toast = document.createElement('div');
      toast.className = `mianshiya-toast ${message.type}`;
      toast.textContent = message.message;
      document.body.appendChild(toast);

      // 自动移除
      setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
      }, message.duration ?? 3000);
    }

    // 抓取题目内容
    function extractQuestion(): QuestionData | null {
      // 抓取题目
      const titleEl = document.querySelector(SELECTORS.question);
      if (!titleEl) {
        showToast({ type: 'error', message: '未找到题目内容' });
        return null;
      }

      // 获取题目文本
      const title = titleEl.textContent?.trim() || '';

      // 抓取答案
      const answerEl = document.querySelector(SELECTORS.answer);
      const answer = answerEl?.innerHTML || '';

      if (!answer) {
        showToast({ type: 'warning', message: '未找到答案内容，将只保存题目' });
      }

      return {
        title,
        answer,
        url: window.location.href
      };
    }

    // 创建悬浮按钮
    function createFloatButton(): HTMLButtonElement {
      const btn = document.createElement('button');
      btn.className = 'mianshiya-float-btn';
      btn.innerHTML = `
        <span class="mianshiya-btn-tooltip">保存到 Anki</span>
        <svg class="mianshiya-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
      `;

      btn.addEventListener('click', handleSaveClick);
      return btn;
    }

    // 处理保存按钮点击
    async function handleSaveClick(event: MouseEvent): Promise<void> {
      const btn = event.currentTarget as HTMLButtonElement;

      // 防止重复点击
      if (btn.classList.contains('loading')) {
        return;
      }

      // 抓取内容
      const question = extractQuestion();
      if (!question) {
        return;
      }

      // 设置加载状态
      btn.classList.add('loading');
      btn.innerHTML = `
        <span class="mianshiya-btn-tooltip">正在处理...</span>
        <svg class="mianshiya-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.3"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"></path>
        </svg>
      `;

      try {
        // 发送到 background 处理
        const response = await sendToBackground<SaveToAnkiRequest>('SAVE_TO_ANKI', { question });

        if (response.success) {
          showToast({
            type: 'success',
            message: '已成功保存到 Anki！'
          });
        } else {
          showToast({
            type: 'error',
            message: response.error || '保存失败'
          });
        }
      } catch (error) {
        showToast({
          type: 'error',
          message: error instanceof Error ? error.message : '未知错误'
        });
      } finally {
        // 恢复按钮状态
        btn.classList.remove('loading');
        btn.innerHTML = `
          <span class="mianshiya-btn-tooltip">保存到 Anki</span>
          <svg class="mianshiya-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
        `;
      }
    }

    // 检查是否在题目详情页
    function isQuestionPage(): boolean {
      const hasQuestion = document.querySelector(SELECTORS.question) !== null;
      const isDetailPage = /mianshiya\.com\/question\/\d+/.test(window.location.href) ||
                           /mianshiya\.com\/\d+/.test(window.location.href);

      return hasQuestion || isDetailPage;
    }

    // 注入样式
    injectStyles();

    // 检查是否在题目页面
    if (!isQuestionPage()) {
      console.log('[Content] 不在题目详情页，跳过按钮注入');
      return;
    }

    // 创建并注入悬浮按钮
    const btn = createFloatButton();
    document.body.appendChild(btn);

    console.log('[Content] 悬浮按钮已注入');
  }
});
