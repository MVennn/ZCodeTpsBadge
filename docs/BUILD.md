# 构建与验证

> **一句话**：环境、路径配置、打补丁 / 还原 / 预览 / 检查的命令，以及改完必须跑的三层验证。

---

## 1. 环境

| 依赖 | 版本 | 用途 |
|---|---|---|
| Windows | 10/11 | 目标平台 |
| ZCode 桌面版 | Electron | 宿主 |
| Node.js | 20+ | 补丁、还原、预览、检查 |
| Node.js | 22+ | 仅 CDP 注入器（全局 `WebSocket`） |
| Python + Pillow | 3.9+ | 仅重新生成图标 / 社交预览 |

徽标本身没有运行时依赖。

## 2. 路径配置

解析顺序：

1. 环境变量 `ZCODE_RESOURCES` / `ZCODE_EXE`；
2. 项目根 `config.local.json`（gitignored）；
3. `%LOCALAPPDATA%\Programs\ZCode\resources`。

`config.local.json` 示例：

```json
{
  "zcodeResources": "C:/Users/You/AppData/Local/Programs/ZCode/resources",
  "zcodeExe": "C:/Users/You/AppData/Local/Programs/ZCode/ZCode.exe"
}
```

查看当前解析结果：

```bash
node src/which.mjs resources
node src/which.mjs exe
```

## 3. 常用命令

```bash
npm run check          # 语法 + 链接 + 资源 + 本机路径检查
npm run preview        # 生成并启动本地预览（8766）
npm run patch          # 打补丁（要求 ZCode 完全退出）
npm run patch:force    # ZCode 运行时写入，下次完全重启生效
npm run restore        # 还原
python tools/make_social_preview.py --ico   # 重新生成 logo / ico / social preview
```

不使用 npm 时的等价命令：

```bash
node tools/ci/check.mjs
node tools/preview/build.mjs
node tools/preview/serve.mjs
node src/patch.mjs --apply
node src/restore.mjs
```

## 4. 三层验证

改完补丁或徽标代码后必须跑：

```bash
# 1) 干跑：只读，确认目标条目与大小
node src/patch.mjs

# 2) 外部 preload 语法
RES="$(node src/which.mjs resources)"
node --check "$RES/app.asar.unpacked/out/preload/index.cjs"

# 3) 让 Electron 自己解析 asar 路径
cd "$(dirname "$RES")"
ELECTRON_RUN_AS_NODE=1 ./ZCode.exe -e "const fs=require('fs');const b=fs.readFileSync('resources/app.asar/out/preload/index.cjs');console.log(b.length, b.toString('utf8').includes('zcode-tps-badge'));"
```

第 3 步返回的字节数应等于 apply 输出里的 `external=`，且第二项为 `true`。

**真机效果没验就明说。** 补丁写对不等于徽标可见；必须完全退出 ZCode 再启动确认。

## 5. 预览

```bash
node tools/preview/build.mjs
node tools/preview/serve.mjs
# 深色 http://127.0.0.1:8766/index.html
# 浅色 http://127.0.0.1:8766/light/index.html
# 计数夹具 http://127.0.0.1:8766/index.html?test=1
```

`?test=1` 页面暴露 `__appendAssistant` / `__appendSidebar` / `__appendUser` /
`__appendTool` / `__addHistoryMessage`，用于确认计数范围。

## 6. 检查项

`tools/ci/check.mjs` 会检查：

- 所有 `.mjs` 通过 `node --check`；
- Markdown 相对链接可解析；
- 必需文件与资源存在；
- `docs/` 无孤儿文档；
- 仓库文本不含本机用户名路径或明显密钥。

CI 配置见 `.github/workflows/ci.yml`。

## 7. 失败处理

| 现象 | 处理 |
|---|---|
| `app.asar not found` | 检查 `ZCODE_RESOURCES` 或 `config.local.json` |
| `ZCode is running` | 托盘完全退出，或 `npm run patch:force` |
| 外部 preload 语法失败 | 检查 `src/badge-source.mjs`，重新 apply |
| 徽标不显示 | 见 [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
