/**
 * Content Script - 面试鸭页面内容脚本
 */

import { defineContentScript } from 'wxt/utils/define-content-script';
import type { QuestionData, ToastMessage, Message, MessageResponse, SaveToAnkiRequest, CheckDuplicateRequest, CheckDuplicateResponse, DeleteNotesRequest, AppConfig } from '@/types';

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
      .mianshiya-dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999998;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .mianshiya-dialog {
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 400px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      }
      .mianshiya-dialog h3 {
        margin: 0 0 12px;
        font-size: 16px;
        color: #1f2937;
      }
      .mianshiya-dialog p {
        margin: 0 0 20px;
        font-size: 14px;
        color: #6b7280;
        line-height: 1.5;
      }
      .mianshiya-dialog-buttons {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }
      .mianshiya-dialog-btn {
        padding: 8px 16px;
        border-radius: 6px;
        border: none;
        font-size: 14px;
        cursor: pointer;
        font-weight: 500;
      }
      .mianshiya-dialog-btn-primary {
        background: #667eea;
        color: white;
      }
      .mianshiya-dialog-btn-secondary {
        background: #e5e7eb;
        color: #374151;
      }
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

    function showConfirmDialog(title: string, message: string): Promise<boolean> {
      return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'mianshiya-dialog-overlay';
        
        const dialog = document.createElement('div');
        dialog.className = 'mianshiya-dialog';
        dialog.innerHTML = `
          <h3>${title}</h3>
          <p>${message}</p>
          <div class="mianshiya-dialog-buttons">
            <button class="mianshiya-dialog-btn mianshiya-dialog-btn-secondary">取消</button>
            <button class="mianshiya-dialog-btn mianshiya-dialog-btn-primary">继续</button>
          </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const handleResolve = (value: boolean) => {
          overlay.remove();
          resolve(value);
        };

        dialog.querySelector('.mianshiya-dialog-btn-secondary')?.addEventListener('click', () => handleResolve(false));
        dialog.querySelector('.mianshiya-dialog-btn-primary')?.addEventListener('click', () => handleResolve(true));
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) handleResolve(false);
        });
      });
    }

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
        const shouldContinue = await showConfirmDialog(
          '检测到登录限制',
          '答案可能不完整（需要登录查看完整内容）。是否继续保存可见部分？'
        );
        
        if (!shouldContinue) {
          showToast({ type: 'info', message: '已取消保存' });
          return null;
        }
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
        <span class="mianshiya-btn-tooltip">正在处理...</span>
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

        // 检查是否有重复
        const configResponse = await sendToBackground('GET_CONFIG');
        if (!configResponse.success) {
          showToast({ type: 'error', message: '获取配置失败' });
          resetButton(btn);
          return;
        }
        
        const config = configResponse.data as AppConfig;
        const checkResponse = await sendToBackground<CheckDuplicateRequest, CheckDuplicateResponse>('CHECK_DUPLICATE', {
          title: question.title,
          deckName: config.deckName,
          frontField: config.frontField
        });

        if (checkResponse.success && checkResponse.data?.hasDuplicate) {
          // 有重复，让用户选择
          const shouldReplace = await showConfirmDialog(
            '检测到重复卡片',
            `题目 "${question.title}" 已存在于卡组中。是否删除旧卡片并重新添加？`
          );
          
          if (!shouldReplace) {
            showToast({ type: 'info', message: '已取消保存' });
            resetButton(btn);
            return;
          }

          // 删除旧卡片
          const deleteResponse = await sendToBackground<DeleteNotesRequest>('DELETE_NOTES', {
            noteIds: checkResponse.data?.noteIds || []
          });
          
          if (!deleteResponse.success) {
            showToast({ type: 'error', message: '删除旧卡片失败' });
            resetButton(btn);
            return;
          }
        }

        const response = await sendToBackground<SaveToAnkiRequest>('SAVE_TO_ANKI', { question });

        if (response.success) {
          showToast({ type: 'success', message: '已成功保存到 Anki！' });
        } else {
          showToast({ type: 'error', message: response.error || '保存失败' });
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
