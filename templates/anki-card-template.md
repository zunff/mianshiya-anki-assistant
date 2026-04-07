# Anki 卡片模板

> 此文件为 Anki 卡片的样式模板，非本项目业务代码，仅作为 AI 生成卡片内容的参考。

## 卡片结构

### 正面模板 (Front Template)
```html
<div class="card-front">
	{{FrontSide}}
</div>

<hr>

<div class="card-content">
    {{Back}}
</div>
```

### 样式 (Styling)
```css
/* --- 全局基础设置 --- */
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

/* --- 卡片正面样式 --- */
.card-front {
    display: flex;
    justify-content: center;
    align-items: center;
}

/* --- 卡片全局：优先适配手机 --- */
.card {
    font-family: "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
    font-size: 16px;
    line-height: 1.6;
    color: #134E4A;
    background: linear-gradient(135deg, #F0FDFA 0%, #ECFEFF 100%);
    max-width: 100%;
    margin: 8px auto;
    padding: 0 10px;
    text-align: left;
}

/* --- 核心内容区 --- */
.card-content {
    background-color: #ffffff;
    padding: 16px 18px;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(15, 118, 110, 0.08);
    color: #134E4A;
    border: 1px solid rgba(20, 184, 166, 0.1);
}

/* --- 标题样式 --- */
.card-content h3 {
    font-size: 17px;
    font-weight: 600;
    color: #0F766E;
    margin: 14px 0 8px 0;
    padding: 6px 12px;
    background: linear-gradient(90deg, #CCFBF1 0%, #F0FDFA 100%);
    border-left: 3px solid #14B8A6;
    border-radius: 4px;
}

.card-content h3:first-child {
    margin-top: 0;
}

.card-content h4 {
    font-size: 16px;
    font-weight: 600;
    color: #0F766E;
    margin: 12px 0 6px 0;
    padding-left: 8px;
    border-left: 2px solid #2DD4BF;
}

/* --- 段落样式 --- */
.card-content p {
    font-size: 15px;
    color: #115E59;
    margin-bottom: 6px;
    padding-left: 2px;
}

/* --- 列表样式 --- */
.card-content ul {
    list-style-type: none;
    padding-left: 0;
    margin: 6px 0 10px 0;
}

.card-content ul li {
    font-size: 15px;
    color: #115E59;
    margin-bottom: 6px;
    padding-left: 20px;
    position: relative;
}

.card-content ul li::before {
    content: "▸";
    color: #14B8A6;
    font-weight: bold;
    position: absolute;
    left: 5px;
    top: 0;
    font-size: 12px;
}

/* --- 代码样式 --- */
.card-content pre {
    background-color: #F0FDFA;
    padding: 12px;
    border-radius: 8px;
    font-size: 13px;
    white-space: pre-wrap;
    word-wrap: break-word;
    margin: 10px 0;
    border: 1px solid #99F6E4;
    overflow-x: auto;
}

.card-content code {
    color: #0F766E;
    background-color: #CCFBF1;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: "JetBrains Mono", "Consolas", monospace;
    font-size: 0.9em;
    font-weight: 500;
}

.card-content pre code {
    background-color: transparent;
    padding: 0;
    color: #134E4A;
}

/* --- 分割线 --- */
hr {
    border: none;
    height: 1px;
    background: linear-gradient(to right, transparent, #99F6E4, transparent);
    margin: 12px auto;
}

/* --- 强调文本 --- */
.card-content strong {
    color: #0F766E;
    font-weight: 600;
}

/* -------------------------- */
/* 深色模式适配 */
/* -------------------------- */
.night_mode {
    background: linear-gradient(135deg, #042F2E 0%, #134E4A 100%) !important;
}

.night_mode .card-content {
    background-color: #1a1a1a !important;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4) !important;
    color: #E2E8F0 !important;
    border: 1px solid rgba(20, 184, 166, 0.2);
}

.night_mode .card-content h3 {
    color: #5EEAD4 !important;
    background: linear-gradient(90deg, rgba(20, 184, 166, 0.15) 0%, rgba(20, 184, 166, 0.05) 100%) !important;
    border-left-color: #2DD4BF !important;
}

.night_mode .card-content h4 {
    color: #5EEAD4 !important;
    border-left-color: #14B8A6 !important;
}

.night_mode .card-content p,
.night_mode .card-content ul li {
    color: #CBD5E1 !important;
}

.night_mode .card-content ul li::before {
    color: #2DD4BF !important;
}

.night_mode .card-content pre {
    background-color: #0F172A !important;
    border-color: #1E3A5F !important;
}

.night_mode .card-content pre code {
    color: #E2E8F0 !important;
}

.night_mode .card-content code {
    color: #5EEAD4 !important;
    background-color: rgba(20, 184, 166, 0.15) !important;
}

.night_mode .card-content strong {
    color: #5EEAD4 !important;
}

.night_mode hr {
    background: linear-gradient(to right, transparent, #2DD4BF, transparent) !important;
}

/* -------------------------- */
/* 超小屏适配 */
/* -------------------------- */
@media (max-width: 400px) {
    .card {
        padding: 0 6px;
    }
    .card-content {
        padding: 14px 16px;
    }
    .card-content h3 {
        font-size: 16px;
        padding: 5px 10px;
    }
    .card-content ul li {
        font-size: 14px;
    }
}
```
