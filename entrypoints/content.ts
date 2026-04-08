/**
 * Content Script - 面试鸭页面内容脚本
 */

import { defineContentScript } from 'wxt/utils/define-content-script';
import type { QuestionData, ToastMessage, Message, MessageResponse } from '@/types';

export default defineContentScript({
  matches: ['https://mianshiya.com/*', 'https://www.mianshiya.com/*'],
  runAt: 'document_idle',

  main() {
    console.log('[Content] 面试鸭 Anki 助手已加载');

    const SELECTORS = {
      question: 'h1.ant-typography, h1',
    };

    const TOAST_STYLES = `
      .mianshiya-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 999999;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        max-width: 480px;
        min-width: 200px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .mianshiya-toast.success { background: #10b981; color: white; }
      .mianshiya-toast.error { background: #ef4444; color: white; }
      .mianshiya-toast.info { background: #3b82f6; color: white; }
      .mianshiya-toast.warning { background: #f59e0b; color: white; }
      .mianshiya-toast-content {
        max-height: 200px;
        overflow-y: auto;
        word-break: break-word;
        line-height: 1.5;
      }
      .mianshiya-toast-actions { display: flex; gap: 8px; justify-content: flex-end; }
      .mianshiya-toast-btn {
        padding: 4px 12px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.3);
        background: rgba(255, 255, 255, 0.1);
        color: white;
        font-size: 12px;
        cursor: pointer;
      }
      .mianshiya-toast-btn:hover { background: rgba(255, 255, 255, 0.2); }
    `;

    const BUTTON_STYLES = `
      .mianshiya-float-btn {
        position: fixed;
        right: 24px;
        bottom: 24px;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, #14B8A6 0%, #0D9488 100%);
        border: 3px solid rgba(255, 255, 255, 0.3);
        cursor: pointer;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 
          0 8px 24px rgba(13, 148, 136, 0.4),
          0 4px 12px rgba(13, 148, 136, 0.3),
          inset 0 2px 4px rgba(255, 255, 255, 0.3);
        color: white;
        font-size: 26px;
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .mianshiya-float-btn:hover {
        transform: scale(1.1) translateY(-2px);
        box-shadow: 
          0 12px 32px rgba(13, 148, 136, 0.5),
          0 6px 16px rgba(13, 148, 136, 0.4);
        border-color: rgba(255, 255, 255, 0.5);
      }
      .mianshiya-float-btn:active {
        transform: scale(1.05);
        box-shadow: 
          0 6px 16px rgba(13, 148, 136, 0.3),
          inset 0 2px 8px rgba(0, 0, 0, 0.2);
      }
      .mianshiya-float-btn.loading { 
        pointer-events: none; 
        opacity: 0.8;
        animation: btn-pulse 1.5s ease-in-out infinite;
      }
      .mianshiya-float-btn.loading .mianshiya-spinner { 
        animation: spin 1s linear infinite; 
      }
      @keyframes spin { 
        from { transform: rotate(0deg); } 
        to { transform: rotate(360deg); } 
      }
      @keyframes btn-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
      .mianshiya-btn-tooltip {
        position: absolute;
        right: 72px;
        background: linear-gradient(135deg, #0F766E 0%, #134E4A 100%);
        color: white;
        padding: 10px 16px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        border: 2px solid rgba(255, 255, 255, 0.1);
      }
      .mianshiya-float-btn:hover .mianshiya-btn-tooltip { 
        opacity: 1;
        transform: translateX(-4px);
      }
    `;

    function injectStyles(): void {
      if (!document.querySelector('#mianshiya-anki-styles')) {
        const style = document.createElement('style');
        style.id = 'mianshiya-anki-styles';
        style.textContent = TOAST_STYLES + BUTTON_STYLES;
        document.head.appendChild(style);
      }
    }

    function showToast(message: ToastMessage): void {
      document.querySelector('.mianshiya-toast')?.remove();

      const toast = document.createElement('div');
      toast.className = `mianshiya-toast ${message.type}`;

      const content = document.createElement('div');
      content.className = 'mianshiya-toast-content';
      content.textContent = message.message;
      toast.appendChild(content);

      if (message.type === 'error') {
        const actions = document.createElement('div');
        actions.className = 'mianshiya-toast-actions';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'mianshiya-toast-btn';
        copyBtn.textContent = '复制';
        copyBtn.onclick = async (e) => {
          e.stopPropagation();
          try {
            await navigator.clipboard.writeText(message.message);
            copyBtn.textContent = '已复制';
          } catch {
            copyBtn.textContent = '失败';
          }
        };

        const closeBtn = document.createElement('button');
        closeBtn.className = 'mianshiya-toast-btn';
        closeBtn.textContent = '关闭';
        closeBtn.onclick = () => toast.remove();

        actions.appendChild(copyBtn);
        actions.appendChild(closeBtn);
        toast.appendChild(actions);
      }

      document.body.appendChild(toast);

      setTimeout(() => toast.remove(), message.duration ?? 5000);
    }

    async function sendToBackground<T = unknown, R = unknown>(
      type: string,
      payload?: T
    ): Promise<MessageResponse<R>> {
      try {
        // 检查扩展上下文是否有效
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
          showToast({ type: 'error', message: '扩展已重新加载，请刷新页面' });
          return { success: false, error: '扩展已重新加载，请刷新页面' };
        }
        const message: Message<T> = { type: type as never, payload };
        const response = await chrome.runtime.sendMessage(message);
        return response as MessageResponse<R>;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        // 检测是否是扩展上下文失效
        if (
          errorMsg.includes('Extension context invalidated') ||
          errorMsg.includes('Extension context invalidated') ||
          errorMsg.includes('sendMessage')
        ) {
          showToast({ type: 'error', message: '扩展已重新加载，请刷新页面' });
          return { success: false, error: '扩展已重新加载，请刷新页面' };
        }
        return { success: false, error: errorMsg };
      }
    }

    function cleanHtml(element: Element): string {
      const clone = element.cloneNode(true) as Element;
      
      clone.querySelectorAll('img').forEach(img => img.remove());
      
      clone.querySelectorAll('.code-block-extension-header').forEach(header => header.remove());
      
      clone.querySelectorAll('[data-id]').forEach(el => el.removeAttribute('data-id'));
      
      clone.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
      
      clone.querySelectorAll('code.hljs').forEach(code => {
        const text = code.textContent || '';
        code.innerHTML = text;
        code.removeAttribute('data-highlighted');
        code.classList.remove('hljs');
      });
      
      clone.querySelectorAll('pre').forEach(pre => {
        const code = pre.querySelector('code');
        if (code) {
          const lang = code.className.match(/language-(\w+)/)?.[1];
          if (lang && !code.textContent?.includes('```')) {
            code.textContent = '```' + lang + '\n' + code.textContent + '\n```';
          }
        }
      });
      
      return clone.innerHTML.trim();
    }

    function waitForAnswerContent(timeout = 10000): Promise<{ html: string; isPartial: boolean }> {
      return new Promise((resolve) => {
        const check = (): { html: string; isPartial: boolean } | null => {
          const markdownBodies = document.querySelectorAll('.markdown-body');
          let bestMatchEl: Element | null = null;
          let bestMatchText = '';
          
          markdownBodies.forEach((el) => {
            const text = el.textContent?.trim() || '';
            
            if (text.length > 30 && text.length > bestMatchText.length) {
              bestMatchEl = el;
              bestMatchText = text;
            }
          });
          
          if (bestMatchEl) {
            const hasLoginButton = bestMatchText.includes('点击登录查看完整内容') || 
                                   bestMatchText.includes('登录查看完整');
            return {
              html: cleanHtml(bestMatchEl),
              isPartial: hasLoginButton
            };
          }
          return null;
        };

        const result = check();
        if (result) {
          resolve(result);
          return;
        }

        const observer = new MutationObserver(() => {
          const result = check();
          if (result) {
            observer.disconnect();
            resolve(result);
          }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
          observer.disconnect();
          resolve(check() || { html: '', isPartial: false });
        }, timeout);
      });
    }

    async function extractQuestion(): Promise<QuestionData | null> {
      const titleEl = document.querySelector(SELECTORS.question);
      if (!titleEl) {
        showToast({ type: 'error', message: '未找到题目内容' });
        return null;
      }

      const title = titleEl.textContent?.trim() || '';
      const { html: answer, isPartial } = await waitForAnswerContent();

      if (!answer) {
        showToast({ type: 'warning', message: '未找到答案内容，将只保存题目' });
        return { title, answer: '', url: window.location.href };
      }

      if (isPartial) {
        showToast({ type: 'warning', message: '检测到登录限制，答案可能不完整，将保存可见部分' });
      }

      return { title, answer, url: window.location.href };
    }

    function createFloatButton(): HTMLButtonElement {
      const btn = document.createElement('button');
      btn.className = 'mianshiya-float-btn';
      btn.innerHTML = `
        <span class="mianshiya-btn-tooltip">保存到 Anki</span>
        <svg class="mianshiya-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
      `;
      btn.addEventListener('click', handleSaveClick);
      return btn;
    }

    async function handleSaveClick(event: MouseEvent): Promise<void> {
      const btn = event.currentTarget as HTMLButtonElement;
      if (btn.classList.contains('loading')) return;

      btn.classList.add('loading');
      btn.innerHTML = `
        <span class="mianshiya-btn-tooltip">提交中...</span>
        <svg class="mianshiya-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.3"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"></path>
        </svg>
      `;

      try {
        const question = await extractQuestion();
        if (!question) {
          resetButton(btn);
          return;
        }

        const response = await sendToBackground<{ duplicate?: boolean; started?: boolean; reason?: string }>('START_TASK', { question });

        if (response.success) {
          if (response.data?.duplicate) {
            showToast({ type: 'info', message: '该题目已收集过' });
          } else if (response.data?.started) {
            showToast({ type: 'success', message: '任务已提交，请打开扩展查看进度' });
          } else {
            showToast({ type: 'info', message: response.data?.reason || '任务已存在' });
          }
        } else {
          showToast({ type: 'error', message: response.error || '提交失败' });
        }
      } catch (error) {
        showToast({ type: 'error', message: error instanceof Error ? error.message : '未知错误' });
      } finally {
        resetButton(btn);
      }
    }

    function resetButton(btn: HTMLButtonElement): void {
      btn.classList.remove('loading');
      btn.innerHTML = `
        <span class="mianshiya-btn-tooltip">保存到 Anki</span>
        <svg class="mianshiya-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
      `;
    }

    function isQuestionPage(): boolean {
      const hasQuestion = document.querySelector(SELECTORS.question) !== null;
      const isDetailPage = /mianshiya\.com\/(bank\/\d+\/)?question\/\d+/.test(window.location.href);
      return hasQuestion || isDetailPage;
    }

    function injectButton(): void {
      document.querySelector('.mianshiya-float-btn')?.remove();
      if (!isQuestionPage()) return;
      const btn = createFloatButton();
      document.body.appendChild(btn);
      console.log('[Content] 悬浮按钮已注入');
    }

    injectStyles();

    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(injectButton, 500);
      }
    });
    urlObserver.observe(document.body, { childList: true, subtree: true });

    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      originalPushState.apply(history, args);
      setTimeout(injectButton, 500);
    };
    window.addEventListener('popstate', () => setTimeout(injectButton, 500));

    setTimeout(injectButton, 500);
  }
});
