import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '面试鸭 Anki 助手',
    description: '将面试鸭题目一键保存到 Anki',
    version: '1.0.0',
    permissions: ['storage', 'activeTab', 'alarms'],
    host_permissions: [
      'https://mianshiya.com/*',
      'http://localhost:8765/*',
      'https://*/*'
    ]
  }
});
