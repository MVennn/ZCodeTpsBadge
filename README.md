# ZCode Tok/s Badge

![License](https://img.shields.io/badge/License-MIT-blue) ![Platform](https://img.shields.io/badge/Platform-Windows-0078D4) ![Node](https://img.shields.io/badge/Node-20%2B-339933)

> **一句话**：给 ZCode 桌面版聊天界面右下角加一个胶囊形 `tok/s` 徽标，样式跟随 ZCode 主题。

## 这是什么

在 ZCode 桌面版（Electron）的渲染页里注入一个轻量徽标：流式输出时显示估算的 token 吞吐量，
空闲后回到 `— tok/s`。不修改 ZCode 源码、不碰网络请求、不读取对话内容，只统计页面上正在增长的文本。

徽标是**估算值**：CJK 0.6 token/字、其他 0.25 token/字符，思考文本也计入；不是模型返回的精确 usage。
统计范围只限**助手消息正文**：侧边栏、用户消息、工具调用、终端、开发者工具都不计入。

## 效果

- 流式输出：`42.1 tok/s`（超过 100 时取整）
- 空闲约 1.8 秒：`— tok/s`
- 胶囊外观：ZCode 卡片底色 + 10% 前景色描边 + 系统字体，深 / 浅主题自动适配
- 位置：输入框底部工具条、用量 / 模型选择器左侧；窗口缩放时随工具条重排，并按宽度自动收缩（先隐藏圆点，再隐藏单位，最后缩小字号）
- 悬停徽标：弹出速度统计卡（当前 / 平均 / 最高 / 最低 / 累计 tokens / 活跃时长）

不需要改 ZCode 就能看效果：

```bash
node tools/preview/build.mjs
node tools/preview/serve.mjs
# 深色：http://127.0.0.1:8766/index.html
# 浅色：http://127.0.0.1:8766/light/index.html
```

## 原理

1. 修改 `resources/app.asar` 头部，把 `out/preload/index.cjs` 标记为 `unpacked`。
2. 把原文件复制到 `resources/app.asar.unpacked/out/preload/index.cjs`，末尾追加徽标代码。
3. Electron 每次启动都会加载外部这份 preload，徽标自动生效。
4. 头部长度保持不变（空格补齐），所有文件偏移不受影响；原始头部备份为 `app.asar.header.tps-bak`。

机制、边界与失败模式见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 环境要求

- Windows + ZCode 桌面版（Electron）
- Node.js 20+（打补丁 / 还原 / 预览；徽标本身无依赖）
- 备用模式的 CDP 注入器需要 Node.js 22+（用到全局 `WebSocket`）

ZCode 路径按以下顺序解析：

1. 环境变量 `ZCODE_RESOURCES` / `ZCODE_EXE`
2. 项目根目录的 `config.local.json`（从 `config.example.json` 复制，已 gitignore）
3. 默认 `%LOCALAPPDATA%\Programs\ZCode\resources`

ZCode 装在非默认盘时，复制一份配置：

```json
{
  "zcodeResources": "D:/Apps/ZCode/resources",
  "zcodeExe": "D:/Apps/ZCode/ZCode.exe"
}
```

查看当前解析结果：`node src/which.mjs resources`。

## 安装

1. 从**托盘图标**完全退出 ZCode（点窗口 X 只是收进托盘，进程还在）。
2. 双击 `tools/apply.cmd`，看到 `Applied` 和 `verified: unpacked=true ...`。
3. 用平时的方式启动 ZCode。
4. 聊天时右下角出现胶囊徽标。

命令行等价：

```bash
node src/patch.mjs --apply
```

ZCode 正在运行又不想退出时，可以 `node src/patch.mjs --apply --force`；
补丁会立即写入，但徽标要等**下次完全重启**才出现。

## 使用

- 徽标在输入框底部工具条里、用量左侧，随窗口缩放重排并自动收缩；不拦截鼠标（`pointer-events: none`）。
- 只在工具条出现后注入，不会先出现在右下角。
- 有流式文本时显示数值，停止输出约 1.8 秒后变回 `— tok/s`。
- 鼠标悬停徽标显示本次运行的统计：当前、平均、最高、最低、累计 tokens、活跃时长。
- 只统计聊天区里的助手输出；输入框、侧边栏、用户消息、工具调用、终端、开发者工具里的文本不计入。

## ZCode 升级后

ZCode 升级会替换 `app.asar`，徽标随之消失。重新执行一次安装步骤即可。

## 排错

见 [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)。最常见的三类：

- 只关了窗口没退托盘 → preload 没有重新加载；
- ZCode 升级覆盖了 `app.asar` → 重新 apply；
- 补丁在 ZCode 运行时被安全检查拒绝 → 退出后重试，或加 `--force`。

## 反馈

问题与建议：<https://github.com/MVennn/ZCodeTpsBadge/issues>。
请附上 ZCode 版本、`node src/patch.mjs` 的输出和复现步骤。

## 卸载

1. 从托盘完全退出 ZCode。
2. 双击 `tools/restore.cmd`（或 `node src/restore.mjs`）。
3. 启动 ZCode，徽标消失。

## 备用模式（CDP，不改 app.asar）

如果不想修改 ZCode 安装文件，或者补丁失效，可以用 `tools/launch-zcode-tps.vbs`：

- 以 `--remote-debugging-port=9222` 启动 ZCode（只监听 127.0.0.1）；
- 后台 `tools/injector.mjs` 通过 CDP 注入同一个徽标；
- 需要先完全退出 ZCode，启动器会检查；
- 运行期间本机任意进程都能连 9222 控制 ZCode（包括读对话），只建议在自己机器上用。

## 文件结构

```
ZCodeTpsBadge/
├── README.md                 # 本文件：面向使用者
├── CHANGELOG.md              # 症状 / 根因 / 改法 / 验证
├── CONTRIBUTING.md           # 改动前先读什么
├── PROGRESS.md               # 最近一次任务的断点记录（不随仓库分发）
├── LICENSE                   # MIT
├── config.example.json       # 本机路径配置示例
├── docs/                     # 文档正本（索引见 docs/README.md）
├── src/
│   ├── badge-source.mjs      # 徽标代码（preload 与 CDP 共用）
│   ├── config.mjs            # ZCode 路径解析
│   ├── which.mjs             # 打印解析结果
│   ├── patch.mjs             # asar 补丁
│   └── restore.mjs           # 还原
└── tools/
    ├── apply.cmd             # 双击打补丁
    ├── restore.cmd           # 双击还原
    ├── injector.mjs          # CDP 注入器（备用模式）
    ├── launch-zcode-tps.*    # 备用模式启动器
    └── preview/              # 本地预览（build.mjs / serve.mjs）
```

## 边界与风险

- 只做界面注入：不修改模型请求、不读取对话内容、不上传任何数据。
- 修改 `app.asar` 属于对 ZCode 安装目录的非官方改动；ZCode 升级会覆盖，需重新打补丁。
- 徽标数值是估算值，不用于计费或性能考核。
- 本项目仅供个人学习与自用，与 ZCode 官方无关。

## 文档

文档索引：[docs/README.md](docs/README.md)。文档规则见 [docs/DOC-RULES.md](docs/DOC-RULES.md)。

## 许可证

[MIT](LICENSE)。修改 ZCode 安装目录属于个人行为，风险自负；本项目与 ZCode 官方无关。
