# 注入架构

> **一句话**：讲清楚徽标如何在不动 asar 数据区的前提下，通过「等长头部 + unpacked preload」
> 在每次 ZCode 启动时注入，以及补丁、重建、还原各自做什么。

---

## 1. 目标与约束

- 目标：ZCode 每次启动都自动出现徽标，不需要专用启动器、不开调试端口。
- 约束：不能重新打包整个 asar（约 341 MB），不能移动任何已有文件的数据偏移。
- 结论：只改 asar 头部里一个条目的 `unpacked` / `size` / `integrity`，
  并把该条目对应的文件复制到 `app.asar.unpacked`。

## 2. 为什么选 preload 补丁（而不是 CDP）

| 方案 | 优点 | 代价 |
|---|---|---|
| asar unpacked preload（主方案） | 普通图标启动即生效；无额外进程；无调试端口 | 修改安装目录；ZCode 升级后要重打 |
| CDP 注入（备用） | 完全不改安装文件 | 必须用专用启动器开 9222；本机进程可控制 ZCode |

两套方案共用同一份徽标代码（`src/badge-source.mjs`），保证外观与统计逻辑一致。

## 3. asar 结构与本项目用到的不变量

asar 文件布局：

```
0            : 4 字节 header size picker
4            : 4 字节 header size
8            : 4 字节 jsonSize
12           : 4 字节 jsonSize
16           : header JSON（jsonSize 字节）
16 + jsonSize: 文件数据区（dataBase）
```

实际读取以 `readUInt32LE(12)` 为准（见 `src/patch.mjs` 的 `readHeader`）。

每个文件条目形如：

```json
{ "size": 781611, "offset": "12345", "integrity": { "algorithm": "SHA256", "...": "..." } }
```

补丁依赖三条不变量：

1. **头部长度不变**：新 JSON 用空格（`0x20`）补齐到原 `jsonSize`，`dataBase` 因此不变，
   所有 `offset` 继续有效。
2. **只动目标条目**：`out/preload/index.cjs` 的 `size` 改成新文件长度，`unpacked` 置 `true`，
   删除 `offset`，重算 `integrity`。其他条目原样保留。
3. **先外部文件、后头部**：Electron 一旦看到 `unpacked=true` 就会去读外部文件；
   顺序反了会有一瞬间指向不存在的文件。

## 4. 补丁四步

`src/patch.mjs`：

1. 读头部 JSON，定位 `out/preload/index.cjs`。
2. 从 `dataBase + offset` 读出原始 preload 字节，把 `badgeSource.toString()` 追加到末尾。
3. 把新文件写到 `resources/app.asar.unpacked/out/preload/index.cjs`（临时文件 + rename）。
4. 首次应用时备份原始头部到 `app.asar.header.tps-bak`，然后把新 JSON 写回头部（等长）。

输出会打印 `original size` / `patched size` / `verified: unpacked=true size=... external=...`。

## 5. 启动加载链路

```
ZCode.exe
  └─ Electron 读取 resources/app.asar 头部
       └─ out/preload/index.cjs 标记为 unpacked
            └─ 读取 resources/app.asar.unpacked/out/preload/index.cjs
                 └─ 末尾的徽标 IIFE 在 renderer 执行
                      └─ 监听 DOM，在输入框工具条渲染 #zcode-tps-badge
```

徽标脚本的启动条件（`src/badge-source.mjs`）：

- `location.pathname` 以 `index.html` 结尾；
- 页面里有 `#root`；
- 尚未安装过（`window.__zcodeTpsBadgeInstalled`）且不存在 `#zcode-tps-badge`。

挂载位置：只插入输入框底部工具条 `[data-composer-trailing-actions]` 的第一个子节点
（在用量 / 模型选择器左侧）。工具条出现前**不注入**，所以启动时不会先出现在右下角。
工具条重渲染可能移除注入节点：MutationObserver 发现 `host.isConnected` 为 false 时重新挂载，
另外每 60 帧检查一次。`ResizeObserver` 观察输入框容器宽度，按 <600 / <480 / <360 三档收缩
（隐藏圆点 → 隐藏单位 → 缩小字号）。
悬停统计卡 `#zcode-tps-tip` 挂在 `document.documentElement` 下（不在聊天区根内，不会被计数），
`position:fixed` 按徽标矩形定位，`pointer-events:none`。

## 6. 重建与还原

### 重建（已打补丁时再跑 `--apply`）

补丁后的头部删掉了目标条目的 `offset`，但原始字节仍留在 asar 数据区。
`src/patch.mjs` 会从 `app.asar.header.tps-bak` 读回原始 `offset` / `size`，
重新取出原始 preload，再追加**当前**的徽标代码。因此改完样式直接再 apply 即可，
不会出现「旧徽标 + 新徽标」叠加。

### 还原

`src/restore.mjs`：

1. 用备份头部覆盖当前头部（长度必须一致）；
2. 删除 `app.asar.unpacked/out/preload/index.cjs`；
3. 徽标消失，备份文件可以保留或删除。

还原要求 ZCode 完全退出（头部写回时更敏感）。

## 7. 运行时数据流

```
聊天区根（[data-testid="chat-view"] / [data-v4-timeline-message-layer] / 输入框父容器）
  └─ MutationObserver 判断变更是否落在根内（characterData / addedNodes）
       └─ 根内所有非跳过文本的 token 总量
            └─ 与上次总量比较，只把增量计入
                 └─ 每 0.35 秒结算一次瞬时速率
                      └─ EMA（0.6 / 0.4）平滑
                           └─ 渲染：>=100 取整，否则 1 位小数
                                └─ 最后一次文本增长后 1.8 秒 → 归零，显示 — tok/s
```

每次 `instant >= 0.05` 的结算同时累计：样本数、tokens、活跃时长、最高 / 最低瞬时速度；
悬停卡直接读取这些值，不在 DOM 里反推。

**统计范围是聊天区根，不依赖 `data-trajectory-message-role="assistant"`。**
该属性在真实聊天 DOM 里不总是存在，用它会把计数整个漏掉。根优先取输入框所在的主聊天列
（`[data-v4-composer-dock]` 的父元素），它能同时包住思考块、工具块和消息；
没有时退回 `chat-view` / 时间线。侧边栏在根外；用户消息、输入框 / 按钮 / 终端 /
开发者工具、消息操作按钮 / 状态标签 / 推理标签在 `SKIP` 里排除。
思考文本（`data-reasoning-content`）与工具调用块（`data-tool-call-id`）计入；
工具块内输出也会计入，这是为了让调用阶段也有速度显示的取舍。

**按根总量算增量，不按文本节点算长度。** markdown 流式渲染会替换文本节点，
按节点长度会把已有内容重复计数；这里给聊天区根记一个 token 总量，
只把「这次比上次多出来的部分」计入。第一次见到新根只记录基线；
单次新增子树超过 400 字符（历史消息 / 整段重渲染）也只更新基线、不计入。

跳过区域：`textarea`、`input`、`button`、`contenteditable`、聊天输入框、
输入框工具条、后台 bash / 终端 / 开发者工具面板、用户消息、推理标签、
消息操作按钮与状态标签，见 `SKIP` 选择器。

## 8. 主题继承

ZCode 把主题类挂在 `<html>` 上（`document.documentElement.classList`）：
`dark`、`theme-zai-light`、`theme-zai-dark`。徽标也挂在 `<html>` 下，因此能直接继承
`--color-card`、`--color-border`、`--color-foreground`、`--font-sans` 等变量。

颜色规范与降级值见 [DESIGN.md](DESIGN.md)。

## 9. 失败模式与边界

| 现象 | 原因 | 处理 |
|---|---|---|
| 徽标不出现 | 补丁没应用 / 只关了窗口没退托盘 / 升级覆盖 | 见 [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| 启动白屏或 preload 报错 | 外部 preload 缺失 / 截断 / 语法错误 | 立即 restore，再检查磁盘与临时文件 |
| 头部写坏 | 并发写入 / 磁盘满 / 非等长写入 | 从 `app.asar.header.tps-bak` 还原 |
| 补丁后 ZCode 自动更新 | 升级替换整个 `app.asar` | 重新 apply |
| 同时开 CDP 与补丁 | 两份徽标 | 脚本有 `__zcodeTpsBadgeInstalled` 守卫；仍冲突时关掉其中一个 |

**不要**在 ZCode 运行时执行 `restore`；`patch --force` 可以，因为只改头部字段且等长。

## 10. 验证方法

```bash
# 1) 干跑：只读，打印原始 / 补丁后大小
node src/patch.mjs

# 2) 语法检查外部 preload
RES="$(node src/which.mjs resources)"
node --check "$RES/app.asar.unpacked/out/preload/index.cjs"

# 3) 让 Electron 自己解析 asar 路径，确认读到的是外部文件
cd "$(dirname "$RES")"
ELECTRON_RUN_AS_NODE=1 ./ZCode.exe -e "const fs=require('fs');const b=fs.readFileSync('resources/app.asar/out/preload/index.cjs');console.log(b.length, b.toString('utf8').includes('zcode-tps-badge'));"
```

第 3 步返回的字节数应等于 `verified` 里的 `external=`，且第二项为 `true`。

## 11. 文件职责

| 文件 | 职责 |
|---|---|
| `src/badge-source.mjs` | 徽标全部逻辑与样式；无依赖、可序列化 |
| `src/patch.mjs` | 应用 / 重建补丁；干跑；`--force` |
| `src/restore.mjs` | 还原头部并删除外部 preload |
| `tools/injector.mjs` | CDP 备用注入 |
| `tools/launch-zcode-tps.*` | 备用模式启动器 |
| `tools/preview/*` | 本地预览生成与静态服务 |
