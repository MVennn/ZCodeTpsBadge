# 排错手册

> **一句话**：按「现象 → 步骤 → 原因 / 解法」组织 —— 先确认补丁状态，再查主题、
> 重复注入与宿主升级。

---

## 0. 先确认三件事

1. 是否**从托盘完全退出**过 ZCode？（点 X 只是收进托盘）
2. `node src/patch.mjs` 的干跑输出是 `Already patched; rebuilding...` 还是 `Dry run only...`？
3. 外部 preload 是否存在？

```bash
ls "$(node src/which.mjs resources)/app.asar.unpacked/out/preload/index.cjs"
```

三项都正常还不显示，再按下面的现象查。

### 0.1 最常见的四类

| 现象 | 多半是 | 去看 |
|---|---|---|
| 徽标根本没出现 | 只关了窗口没退托盘，preload 没重新加载 | [§1](#1-徽标完全不显示) |
| ZCode 升级后徽标消失 | `app.asar` 被换掉了，需要重新 apply | [§1](#1-徽标完全不显示)、[§7](#7-升级后徽标消失) |
| 设置页等界面没有徽标 | 输入框工具条还没渲染，属预期 | [§1](#1-徽标完全不显示) |
| 一直是 `— tok/s` | 还没有完成的主轮请求，或调试数据没读到 | [§2](#2-一直是-toks) |
| 悬停显示「数据源不可用」 | `session/debug` 通道/方法变了或 tap 没装上 | [§2](#2-一直是-toks) |

## 1. 徽标完全不显示

**步骤**

```bash
node src/patch.mjs
```

- 输出 `Dry run only` → 补丁没应用。完全退出 ZCode 后 `node src/patch.mjs --apply`。
- 输出 `Already patched; rebuilding...` → 补丁在，检查外部文件与语法：

```bash
node --check "$(node src/which.mjs resources)/app.asar.unpacked/out/preload/index.cjs"
```

**原因 / 解法**

| 原因 | 解法 |
|---|---|
| 只关了窗口，进程还在 | 托盘右键退出，再启动 |
| ZCode 升级替换了 `app.asar` | 重新 apply |
| 补丁在运行时被拒绝 | 退出后重试，或 `--apply --force` 后完全重启 |
| 外部 preload 被删 / 截断 | 重新 apply（脚本会重建） |
| 输入框工具条还没渲染 | 徽标只在 `[data-composer-trailing-actions]` 出现后注入；设置页等无工具条的页面不显示，属预期 |

## 2. 一直是 `— tok/s`

**步骤**

1. 先发一条消息，等它**完成**（不是生成中）。徽标在请求完成后、下一次 1 秒轮询
   才会拿到 usage；进行中的请求没有数字，这是预期。
2. 打开开发者工具「Token 调试」，确认表格里有这一轮的 TPS。
3. 悬停徽标看状态行：
   - 「等待首个请求」→ 当前会话还没有完成的主轮请求；
   - 「数据源不可用」→ RPC 失败，见下表；
   - 「未收到调试数据」→ 主世界 tap 没装上，检查补丁是否重建。
4. 能打开 DevTools 时，在 Console 过滤 `[zcode-tps]`：tap 会把具体的
   `readSessionDebug` 错误打出来（连续相同的错误只打一次）。

**原因 / 解法**

| 原因 | 解法 |
|---|---|
| 请求还在生成 | 正常；圆点脉冲、数字保持上一轮，完成后才更新 |
| 当前会话没有完成的主轮请求 | 面板也会是空的；发一条并等完成 |
| `session/debug` 超时 / 通道改名 | ZCode 大版本可能改了内部接口；先跑 `node tools/ci/test-debug-source.mjs`，再按 [ARCHITECTURE.md](ARCHITECTURE.md) §7 核对通道名与方法名 |
| tap 没有注入 | 完全退出 ZCode 后 `node src/patch.mjs --apply` 重建；确认外部 preload 含 `readSessionDebug` |
| 工作区路径对不上 | 窗口 URL 没有 `initialWorkspacePath` 时，tap 会从出站请求里嗅；远程工作区需要 `workspaceIdentity`，见 §7 |
| 子代理 / 后台任务没有数字 | 面板的「主轮请求」本来就不含它们，属预期 |

## 3. 颜色不对 / 看不清

**步骤**

- 在 DevTools（如果可用）里看 `<html>` 的 class：`dark` / `theme-zai-dark` / `theme-zai-light`。
- 检查是否用了自定义主题，导致 `--color-card` / `--color-foreground` 未定义。

**原因 / 解法**

- 徽标只用 `--color-card`、`--color-border`、`--color-foreground`、`--font-sans`，
  并带降级值；自定义主题缺变量时会退回深色降级值。
- 若浅色主题下文字过淡，确认没有改回 `--color-foreground-subtle`
  （该变量只在 `.dark` 定义）。
- 修改后按 [DESIGN.md](DESIGN.md) §7 的流程重建。

## 4. 徽标出现两个

**原因**

- 同时启用了 preload 补丁与 CDP 注入（`tools/launch-zcode-tps.vbs`）。

**解法**

- 二选一：用普通图标启动（保留补丁），或还原补丁后用 TPS 启动器。
- 脚本自带 `__zcodeTpsBadgeInstalled` 与 `#zcode-tps-badge` 双守卫，
  同一页面重复注入会被拦下；两个不同窗口各有一个属于正常。

## 5. `apply` 提示 ZCode is running

**原因**：安全检查检测到 `ZCode.exe` 进程。

**解法**

- 推荐：托盘完全退出后重跑。
- 急用：`node src/patch.mjs --apply --force`，然后完全重启 ZCode。

## 6. ZCode 启动异常 / 白屏 / preload 报错

**步骤**

1. 完全退出 ZCode。
2. `node src/restore.mjs` 还原。
3. 启动确认恢复正常。
4. 重新 apply，并检查磁盘空间与外部文件大小。

**原因 / 解法**

| 原因 | 解法 |
|---|---|
| 外部 preload 缺失 / 截断 | restore 后重新 apply |
| 磁盘写满导致写入不完整 | 清理空间后重试 |
| 头部被并发写坏 | 用 `app.asar.header.tps-bak` 还原；仍失败则重装 ZCode |
| **卡在启动页 / splash 不动** | 0.3.0 初版 tap 抢跑了 `port.start()`，吃掉了 App 的 `Initialize`；当前源码已修为「只挂监听、等 200 再轮询」。若仍卡：`node src/restore.mjs` 还原后重装 ZCode，再用修复后的版本 apply |

## 7. 升级后徽标消失

正常现象。ZCode 升级会替换 `app.asar`。重新执行 [README](../README.md) 的安装步骤。

## 8. 还原失败：Header backup not found

**原因**：补丁从未成功应用，或备份被手动删除。

**解法**

- 没有备份说明头部没被改过，无需还原；确认 `app.asar.unpacked` 下没有残留的
  `out/preload/index.cjs`，有就删掉。
- 如果头部确实被改过但备份丢了，只能重装 ZCode。

## 9. 确认当前状态（一条命令）

```bash
node src/patch.mjs
```

- `Dry run only`：未打补丁；
- `Already patched; rebuilding...` + `verified: unpacked=true`：已打补丁；
- 报 `app.asar not found`：`ZCODE_RESOURCES` 指错了目录。

## 10. 悬停卡不弹出 / 统计全是 `—`

**步骤**

- 确认鼠标停在徽标本体上，不是旁边的用量 / 模型选择器。
- 检查 `#zcode-tps-tip` 是否存在、`data-open` 是否变成 `1`。
- 统计行全是 `—` 时看状态行：等待首个请求 / 数据源不可用 / 未收到调试数据 /
  本轮 TPS 异常（已跳过）。

**原因 / 解法**

| 原因 | 解法 |
|---|---|
| 徽标被其他元素盖住 | 检查自定义 CSS / 插件是否覆盖了 `[data-composer-trailing-actions]` |
| 徽标 `pointer-events` 被改成 `none` | 确认 `src/badge-source.mjs` 里 host 是 `pointer-events:auto` |
| 当前会话没有完成的主轮请求 | 开发者工具「Token 调试」也会是空的；发一条并等请求完成 |
| 最近一轮被判定异常 | 面板该轮生成时长过短或 TPS 超过 2000；徽标只把它挡在统计外，属预期 |
| 刚启动还没拿到快照 | 正常；tap 等 `Initialize(200)` 后开始轮询，最多 2 秒兜底 |
