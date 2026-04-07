# 面试鸭 Anki 助手

将面试鸭（mianshiya.com）题目一键保存到 Anki 的浏览器扩展。

## 功能特性

- 🔘 **悬浮按钮**: 在面试鸭题目详情页自动显示「保存到 Anki」按钮
- 🤖 **AI 精炼**: 使用 AI 将题目和答案精炼成高质量 Anki 卡片
- 📚 **AnkiConnect 集成**: 自动添加卡片到指定牌组
- ⚙️ **灵活配置**: 支持 OpenAI 兼容接口（包括本地模型）
- 🌙 **深色模式**: Popup 界面支持深色模式

## 安装

### 前置要求

- Node.js 18+
- pnpm（推荐）或 npm
- Anki + AnkiConnect 插件

### 构建步骤

```bash
# 安装依赖
pnpm install

# 构建扩展
pnpm build
```

### 加载扩展

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 启用「开发者模式」（右上角开关）
4. 点击「加载已解压的扩展程序」
5. 选择项目的 `.output/chrome-mv3` 目录

## 配置

点击扩展图标打开 Popup 配置界面：

### AI 配置

| 字段 | 说明 | 默认值 |
|------|------|--------|
| Base URL | OpenAI 兼容接口地址 | `https://api.openai.com/v1` |
| API Key | API 密钥 | - |
| Model | 模型名称 | `gpt-4o-mini` |

### AnkiConnect 配置

| 字段 | 说明 | 默认值 |
|------|------|--------|
| 牌组名称 | 目标牌组 | `面试鸭-八股文` |
| 笔记类型 | Anki 笔记类型 | `Basic` |
| 正面字段 | Front 字段名 | `Front` |
| 背面字段 | Back 字段名 | `Back` |

### AnkiConnect 设置

确保 Anki 已安装 AnkiConnect 插件：

1. 打开 Anki
2. 工具 → 插件 → 获取插件
3. 输入代码：`2055492159`
4. 重启 Anki

## 使用方法

1. 访问面试鸭网站（mianshiya.com）的任意题目详情页
2. 页面右下角会出现紫色悬浮按钮
3. 点击按钮，等待处理完成
4. 成功后会显示提示，卡片已添加到 Anki

## AI 精炼 Prompt

使用的 Prompt 会将题目精炼为：

```
正面（Front）：题目原文（保持排版）
背面（Back）：核心知识点 + 标准答案 + 记忆要点 + 易错点（Markdown 格式）
标签：根据内容自动生成 2-4 个标签
```

## 技术栈

- [WXT](https://wxt.dev/) - 现代化浏览器扩展框架
- [React 18](https://react.dev/) - UI 框架
- [TypeScript](https://www.typescriptlang.org/) - 类型安全
- [Tailwind CSS](https://tailwindcss.com/) - 样式
- [Zustand](https://github.com/pmndrs/zustand) - 状态管理

## 项目结构

```
├── entrypoints/
│   ├── background.ts      # 后台脚本
│   ├── content.ts         # 内容脚本
│   └── popup/             # Popup 界面
├── store/
│   └── useAppStore.ts     # Zustand 状态管理
├── types/
│   └── index.ts           # TypeScript 类型定义
└── utils/
    └── message.ts         # 消息通信工具
```

## 开发

```bash
# 安装依赖
pnpm install

# 构建
pnpm build

# 构建 Firefox 版本
pnpm build:firefox

# 打包 zip
pnpm zip
```

## 许可证

MIT
