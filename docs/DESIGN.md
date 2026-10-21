# 徽标视觉规范

> **一句话**：胶囊尺寸、颜色 token、状态与动效的正本 —— 改样式只看这篇，
> 实现固定在 `src/badge-source.mjs`。

---

## 1. 设计目标

- 与 ZCode 同款：卡片底色、10% 描边、系统字体，看起来像 ZCode 自己的状态胶囊。
- 不抢视线：11px、低对比度、无循环动画；只在流式输出时有存在感。
- 跟随主题：深色 / zai-dark / 浅色都不需要单独维护一套颜色。

## 2. 形状与尺寸

| 项 | 值 |
|---|---|
| 外框 | 胶囊，`border-radius: 999px` |
| 高度 | 21px（11px 字 + 4px 上下内边距 + 1px 边框 ×2） |
| 内边距 | `4px 9px` |
| 元素间距 | `6px` |
| 圆点 | 6px 圆形 |
| 位置 | `position: fixed; right: 14px; bottom: 12px` |
| 层级 | `z-index: 2147483647` |
| 交互 | `pointer-events: none; user-select: none` |

实测宽度约 85px（三位数 tok/s）。

## 3. 颜色与字体 token

| 用途 | 值 | 降级值 |
|---|---|---|
| 背景 | `var(--color-card)` | `#2b2b2b` |
| 描边 | `1px solid var(--color-border)` | `rgba(255,255,255,.10)` |
| 文字 | `var(--color-foreground)` | `#e5e5e5` |
| 字体 | `500 11px/1 var(--font-sans)` | `ui-sans-serif, system-ui, sans-serif` |
| 数字 | `font-variant-numeric: tabular-nums` | — |
| 字距 | `letter-spacing: .01em` | — |
| 阴影 | `0 1px 2px rgba(0,0,0,.25)` | — |

各主题下这些变量在 ZCode CSS 里的实际值：

| 主题（`<html>` 类） | `--color-card` | `--color-border` | `--color-foreground` |
|---|---|---|---|
| `dark` | `#262626` | `#fafafa1a` | `#e5e5e5` |
| `theme-zai-dark` | `#2b2b2b` | `#ffffff1a` | `neutral-300` |
| `theme-zai-light` | `#ffffff` | `#0d0d0d1a` | `#262626` |

**禁止**依赖只在 `.dark` 下定义的变量（例如 `--color-foreground-subtle`）：
浅色主题没有它，会退化成浅灰字。需要弱化时用透明度，不改颜色来源。

## 4. 状态

| 状态 | 数值 | 数值透明度 | 单位透明度 | 圆点透明度 |
|---|---|---|---|---|
| 空闲 | `—` | 0.62 | 0.55 | 0.45 |
| 流式输出 | `42.1`（>=100 取整） | 1 | 0.55 | 1 |

- 单位固定显示 `tok/s`，不随状态变化。
- 圆点用 `currentColor`，不写死任何颜色。
- 状态切换用 `opacity .15s ease`，不做循环动画。

## 5. 文案

- 数值：`< 100` 保留 1 位小数；`>= 100` 取整。
- 单位：小写 `tok/s`，与数值之间有一个空格。
- 空闲：em dash `—` + 空格 + `tok/s`。

## 6. 预览与验收

```bash
node tools/preview/build.mjs
node tools/preview/serve.mjs
# 深色 http://127.0.0.1:8766/index.html
# 浅色 http://127.0.0.1:8766/light/index.html
```

验收标准：

1. 两套主题下都能看清数值与单位，胶囊边界可见但不刺眼；
2. 空闲与输出状态有明确的主次差异；
3. 徽标不遮挡 ZCode 右下角可点击控件（`pointer-events: none`）。

## 7. 变更流程

1. 改 `src/badge-source.mjs`；
2. 跑预览并截图对比；
3. `node src/patch.mjs --apply --force` 重建；
4. 完全重启 ZCode 看实际效果；
5. 同步更新本篇与 [CHANGELOG.md](../CHANGELOG.md)（规则见 [DOC-RULES.md](DOC-RULES.md) §4）。
