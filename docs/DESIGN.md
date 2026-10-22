# 徽标视觉规范

> **一句话**：胶囊尺寸、颜色 token、状态与动效的正本 —— 改样式只看这篇，
> 实现固定在 `src/badge-source.mjs`。

---

## 1. 设计目标

- 与 ZCode 同款：卡片底色、10% 描边、系统字体，看起来像 ZCode 自己的状态胶囊。
- 不抢视线：11px、低对比度；只在请求生成中让圆点脉冲，数字本身不跳。
- 跟随主题：深色 / zai-dark / 浅色都不需要单独维护一套颜色。

## 2. 形状与尺寸

| 项 | 值 |
|---|---|
| 外框 | 胶囊，`border-radius: 999px` |
| 高度 | 21px（11px 字 + 4px 上下内边距 + 1px 边框 ×2） |
| 内边距 | `4px 9px` |
| 元素间距 | `6px` |
| 圆点 | 6px 圆形 |
| 位置 | 输入框底部工具条 `[data-composer-trailing-actions]` 的第一个 flex 子项（用量左侧）；工具条出现前不注入 |
| 布局 | `display:inline-flex; flex:0 0 auto`，随工具条重排 |
| 交互 | 徽标本体 `pointer-events:auto`（接收悬停）；`user-select: none` |

实测宽度：完整约 77px，最窄约 27px。

### 响应式收缩

`ResizeObserver` 观察输入框容器宽度，按三档收缩：

| 档位 | 容器宽度 | 变化 | 实测宽度 |
|---|---|---|---|
| 完整 | ≥ 600px | 圆点 + 数值 + 单位 | 77px |
| 1 | 480–599px | 隐藏圆点 | 约 65px |
| 2 | 360–479px | 隐藏圆点 + 单位 | 32px |
| 3 | < 360px | 字号 10px、内边距 `3px 7px` | 27px |

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

| 状态 | 数值 | 数值透明度 | 单位透明度 | 圆点 |
|---|---|---|---|---|
| 无数据 | `—` | 0.62 | 0.55 | 0.45 |
| 空闲（有上一轮） | `42.1`（>=100 取整） | 1 | 0.55 | 0.45 |
| 生成中 | 保持上一轮 | 1 | 0.55 | 1，1.2s 脉冲 |
| 本轮异常（TPS > 2000 或时长 < 100ms） | `—` | 0.62 | 0.55 | 0.45 |

- 单位固定显示 `tok/s`，不随状态变化。
- 圆点用 `currentColor`，不写死任何颜色。
- 数值切换用 `opacity .15s ease`；脉冲动画只作用于圆点，`prefers-reduced-motion`
  下浏览器会自动降级为静态。
- 生成中判定：收到 tap 的 activity 信号后 2 秒内；请求完成（快照 round 数增加）
  或 2 秒无活动即回到空闲。

### 悬停统计卡

鼠标悬停徽标 120ms 后，在徽标正上方弹出统计卡；移开 80ms 后淡出。

| 项 | 值 |
|---|---|
| 容器 | `position:fixed`，`min-width:172px`，`padding:8px 10px`，`border-radius:10px` |
| 背景 / 描边 | `var(--color-card)` / `1px solid var(--color-border)` |
| 阴影 | `0 8px 24px rgba(0,0,0,.35)` |
| 字体 | `500 11px/1.5 var(--font-sans)`，数值 `tabular-nums` |
| 位置 | 徽标上方 8px、水平居中；空间不足时放下方；左右夹在视口 8px 内 |
| 交互 | 卡片 `pointer-events:none`，不挡鼠标 |

内容：本轮速度 / 平均速度 / 最高速度 / 最低速度 / 输出 / 思考 / 输入 /
缓存命中 / 生成耗时 / 会话请求 / 累计输入 / 累计命中 / 状态，共十三行；
各行含义见 [FEATURE-TPS-BADGE.md](FEATURE-TPS-BADGE.md) §5。

## 5. 文案

- 徽标数值：`< 100` 保留 1 位小数；`>= 100` 取整。
- 悬停卡「本轮速度」：固定 1 位小数，与开发者工具表格一致。
- 单位：小写 `tok/s`，与数值之间有一个空格。
- 空闲：em dash `—` + 空格 + `tok/s`。

## 6. 预览与验收

```bash
node tools/preview/build.mjs
node tools/preview/serve.mjs
# 深色 http://127.0.0.1:8766/index.html
# 浅色 http://127.0.0.1:8766/light/index.html
# 计数范围夹具（不自动流式）http://127.0.0.1:8766/index.html?test=1
```

预览页用 `__debugSnapshot(round)` / `__debugActivity()` / `__debugError(message)`
模拟 tap 的 `zcode-tps-debug` 消息。`?test=1` 只保留 DOM 夹具
（`__appendAssistant` 等），用来确认**追加页面文本不再改变徽标数值**。

验收标准：

1. 两套主题下都能看清数值与单位，胶囊边界可见但不刺眼；
2. 空闲、生成中、无数据三种状态有明确的主次差异；
3. 徽标在工具条内随 flex 重排，不覆盖其它控件；悬停卡 `pointer-events:none`，不挡鼠标。

## 7. 变更流程

1. 改 `src/badge-source.mjs`；
2. 跑预览并截图对比；
3. `node src/patch.mjs --apply --force` 重建；
4. 完全重启 ZCode 看实际效果；
5. 同步更新本篇与 [CHANGELOG.md](../CHANGELOG.md)（规则见 [DOC-RULES.md](DOC-RULES.md) §5）。
