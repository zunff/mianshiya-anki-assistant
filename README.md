# 面试鸭 Anki 助手

将面试鸭（mianshiya.com）题目一键保存到 Anki 的浏览器扩展。

## 功能特性

- 🔘 **悬浮按钮**: 在面试鸭题目详情页自动显示「保存到 Anki」按钮
- 🤖 **AI 精炼**: 使用 AI 将题目和答案精炼成自适应原子化 Anki 卡组
- 📚 **AnkiConnect 集成**: 自动添加卡片到指定牌组
- ⚙️ **灵活配置**: 支持 OpenAI 兼容接口（包括本地模型）
- 🔄 **自定义 Anki 地址**: 支持自定义 AnkiConnect 的 Host 和端口
- 🔋 **任务保活与恢复**: 长时间 AI 精炼任务自动保活，后台重启后可尝试恢复处理中任务
- 🧹 **缓存管理**: 一键清空已收集题目缓存

## 效果预览

| 插件弹窗 | Anki 卡片预览 | 生成的卡片 |
|:---:|:---:|:---:|
| ![插件弹窗](img/plugin.png) | ![Anki预览](img/anki_pre.png) | ![Anki卡片](img/anki_cards.png) |

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

## 使用教程

### 第一步：安装 AnkiConnect 插件

1. 打开 Anki
2. 菜单栏：工具 → 插件 → 获取插件
3. 输入代码：`2055492159`
4. 重启 Anki

### 第二步：配置 AI 接口

点击扩展图标打开 Popup 配置界面，切换到「AI 配置」标签：

| 字段 | 说明 | 示例 |
|------|------|------|
| API Base URL | OpenAI 兼容接口地址 | `https://api.openai.com/v1` |
| API Key | API 密钥 | `sk-xxx...` |
| 模型 | 模型名称 | `gpt-4o-mini` |

> 支持所有 OpenAI 兼容接口，如 DeepSeek、通义千问、本地 Ollama 等。

配置完成后点击「保存配置」，然后点击「测试连接」验证配置是否正确。

### 第三步：配置 AnkiConnect

切换到「Anki」标签：

**连接配置**
| 字段 | 说明 | 默认值 |
|------|------|--------|
| Host | AnkiConnect 地址 | `localhost` |
| 端口 | AnkiConnect 端口 | `8765` |

**卡片配置**
| 字段 | 说明 | 默认值 |
|------|------|--------|
| 牌组名称 | 目标牌组 | `面试鸭-八股文` |
| 笔记类型 | Anki 笔记类型 | `Basic` |
| 正面字段 | Front 字段名 | `Front` |
| 背面字段 | Back 字段名 | `Back` |

配置完成后点击「保存配置」，然后点击「测试连接」验证 Anki 是否正常运行。

### 第四步：设置 Anki 卡片模板（推荐）

为了让卡片显示更美观，建议在 Anki 中设置卡片模板：

1. 打开 Anki PC 端
2. 工具 → 管理笔记模板
3. 选择你的笔记类型（如 Basic）
4. 点击「卡片」
5. 将 [templates/anki-card-template.md](templates/anki-card-template.md) 中的 HTML 和 CSS 复制到对应框内：
   - 正面模板 → Front Template 框
   - 背面模板 → Back Template 框
   - 样式 → Styling 框

模板特性：
- 适配手机端显示
- 支持深色模式
- 代码高亮样式
- 清晰的层次结构

### 第五步：开始使用

1. 访问面试鸭网站 的任意题目详情页
2. 页面右下角会出现悬浮按钮
3. 点击按钮，等待处理完成
4. 成功后卡片自动添加到 Anki

## AI 精炼说明

本工具使用 AI 将题目精炼为 **自适应原子化卡组**。AI 会根据题目复杂度，自动拆成 `M` 张基础卡 + `N` 张追问卡：

- 基础卡：`1~3` 张，建议 `1~2` 张
- 追问卡：`0~5` 张，建议 `2~4` 张
- 单题总数：最多 `8` 张

| 卡片类型 | 用途 | 特点 |
|---------|------|------|
| 基础卡 | 讲清核心结论 + 结构骨架 | 简单题通常 1 张，复杂题可按层次或子主题拆成 2~3 张 |
| 追问卡 | 面试常追问点 / 易错点 / 边界点 | 每张卡只保留 1 个 Q→A，避免单卡过难 |

**内容原则**：
- 极简：只保留可检索关键词
- 无代码：不输出代码块/示例代码
- 面试导向：优先区分点、边界、适用场景
- HTML 格式：支持 `<h3> <p> <ul> <li> <strong> <code>`

**拆分规则**：
- 简单题能 1 张说清就不拆；当要点 `<= 5` 且总字数 `<= 80` 时，强制只生成 1 张基础卡
- 复杂题可拆成多张基础卡，按“层次”或“子主题”正交拆分，避免重复
- 追问点不足时不会为了凑数量而硬出追问卡
- 基础卡在前，追问卡在后；`front` 为纯文本，HTML 仅出现在 `back`

## 功能说明

### 清空缓存

在「任务」标签页，点击「清空缓存」按钮可以清除浏览器本地存储的已收集题目记录。

使用场景：
- 想重新收集之前已添加的题目
- 更换 Anki 数据库后需要重新同步

### 自动保存配置

关闭 Popup 窗口时，如果有未保存的配置变更，会自动保存。

### 任务保活与恢复

AI 精炼任务较长时，扩展会自动启动保活机制，尽量避免 Chrome Manifest V3 的 Service Worker 被提前回收。

如果后台脚本在任务处理中被重启，扩展会尝试根据本地保存的任务信息自动恢复处理中任务，降低“AI 精炼中卡死”或处理中断的概率。

### 重复检测

工具会自动检测题目是否已收集，避免重复添加：
- 本地缓存检测（快速）
- Anki tag 检测（跨设备同步）

> 检测时会自动忽略题目标题中的空格，确保 "Redis 集群" 和 "Redis集群" 被识别为同一题。

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
├── utils/
│   └── message.ts         # 消息通信工具
└── templates/
    └── anki-card-template.md  # Anki 卡片模板
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
