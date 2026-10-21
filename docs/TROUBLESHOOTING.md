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

## 2. 一直是 `— tok/s`

**步骤**

- 让模型输出一段长文本，观察是否出现数值。
- 确认页面是主聊天页（`location.pathname` 以 `index.html` 结尾），不是独立窗口或 DevTools。

**原因 / 解法**

| 原因 | 解法 |
|---|---|
| 没有流式文本（只有思考 / 工具调用） | 正常；徽标只统计页面文本增长 |
| 文本增长被跳过规则排除 | 输入框、终端、开发者工具不计入，属预期 |
| 单次新增节点超过 800 字符 | 大块重绘不计入，属预期的防抖 |
| 0.35 秒窗口内不足 0.05 token/s | 会显示 `—`；换长文本再试 |

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
