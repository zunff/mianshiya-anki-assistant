/**
 * 消息工具模块 - 跨脚本通信
 */

import type {
  Message,
  MessageResponse,
  MessageType
} from '@/types';

/**
 * 发送消息到 Background Script
 */
export async function sendToBackground<T = unknown, R = unknown>(
  type: MessageType,
  payload?: T
): Promise<MessageResponse<R>> {
  try {
    const message: Message<T> = { type, payload };
    const response = await chrome.runtime.sendMessage(message);
    return response as MessageResponse<R>;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 发送消息到 Content Script
 */
export async function sendToContentScript<T = unknown, R = unknown>(
  tabId: number,
  type: MessageType,
  payload?: T
): Promise<MessageResponse<R>> {
  try {
    const message: Message<T> = { type, payload };
    const response = await chrome.tabs.sendMessage(tabId, message);
    return response as MessageResponse<R>;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 监听来自其他脚本的消息
 */
export function onMessage<T = unknown, R = unknown>(
  handler: (message: Message<T>, sender: chrome.runtime.MessageSender) => Promise<MessageResponse<R>> | MessageResponse<R>
): () => void {
  const listener = (
    message: Message<T>,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse<R>) => void
  ) => {
    const result = handler(message, sender);

    if (result instanceof Promise) {
      result.then(sendResponse);
      return true; // 保持消息通道打开
    }

    sendResponse(result);
    return false;
  };

  chrome.runtime.onMessage.addListener(listener);

  // 返回取消监听函数
  return () => {
    chrome.runtime.onMessage.removeListener(listener);
  };
}

/**
 * 创建消息处理器构建器
 */
export function createMessageHandler<T = unknown, R = unknown>() {
  const handlers = new Map<MessageType, (payload: T, sender: chrome.runtime.MessageSender) => Promise<MessageResponse<R>> | MessageResponse<R>>();

  return {
    on<K extends MessageType>(
      type: K,
      handler: (payload: T, sender: chrome.runtime.MessageSender) => Promise<MessageResponse<R>> | MessageResponse<R>
    ) {
      handlers.set(type, handler);
    },

    listen() {
      return onMessage<T, R>(async (message, sender) => {
        const handler = handlers.get(message.type);
        if (handler) {
          return handler(message.payload as T, sender);
        }
        return { success: false, error: `Unknown message type: ${message.type}` };
      });
    }
  };
}
