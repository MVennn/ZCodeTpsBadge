<div align="center">

<img src="https://raw.githubusercontent.com/MVennn/ZCodeTpsBadge/main/assets/logo.png" width="128" alt="ZCode Tok/s Badge">

# ZCode Tok/s Badge

**给 ZCode 桌面版聊天界面加一个胶囊形 `tok/s` 徽标**

流式输出时看速度，空闲时安静地待在输入框工具条里。

![CI](https://github.com/MVennn/ZCodeTpsBadge/actions/workflows/ci.yml/badge.svg) ![源码仓库](https://img.shields.io/badge/源码仓库-GitHub-181717?logo=github&logoColor=white) ![问题反馈](https://img.shields.io/badge/问题反馈-Issues-181717?logo=github&logoColor=white) ![Windows](https://img.shields.io/badge/Windows-10%2F11-0078D6?logo=windows&logoColor=white) ![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white) ![License](https://img.shields.io/badge/License-MIT-blue)

</div>

---

## 这是什么

在 ZCode 桌面版聊天页的输入框底部工具条里，注入一个胶囊形徽标：模型还在输出时显示估算的 `tok/s`，停下来就变回 `— tok/s`。

鼠标悬停能看到本次运行的统计：当前、平均、最高、最低、累计 tokens、活跃时长。

它只读页面文本的长度，不读你的对话内容，不碰网络请求，不修改模型请求。徽标上的数值是按文本估算的，不是模型返回的精确 usage。

## 环境要求

| 项 | 要求 |
|---|---|
| 操作系统 | Windows 10 / 11 |
| 宿主应用 | ZCode 桌面版（Electron） |
| Node.js | 20+（打补丁 / 还原 / 预览）；备用模式需要 22+ |
| Python + Pillow | 仅重新生成图标与社交预览时需要 |

## 安装

1. 从**托盘图标**完全退出 ZCode —— 点窗口 X 只是收进托盘，进程还在，补丁不会生效。
2. 双击 `tools\apply.cmd`，看到 `Applied` 和 `verified: unpacked=true`。
3. 按平时的方式启动 ZCode。
4. 输入框底部工具条出现胶囊徽标；发一段消息，它就会跳起来。

命令行等价：

```bash
node src/patch.mjs --apply
```

ZCode 正在运行又不想退出时加 `--force`，补丁会立即写入，但徽标要等下次完全重启才出现。找不到 ZCode 安装目录时，用 `ZCODE_RESOURCES` 环境变量或 `config.local.json` 指定，见 [构建与验证](https://github.com/MVennn/ZCodeTpsBadge/blob/main/docs/BUILD.md)。

## 效果

- 流式输出时显示 `42.1 tok/s`（超过 100 取整），停下来约 1.8 秒后变回 `— tok/s`
- 徽标固定在输入框工具条里、用量左侧，窗口变窄时自动收缩；深浅主题都适配
- 只统计聊天区里增长的文本，输入框、侧边栏、用户消息、终端不计入
- 鼠标悬停可看本次运行的统计

统计口径、挂载位置与收缩档位见 [功能专项：tok/s 徽标](https://github.com/MVennn/ZCodeTpsBadge/blob/main/docs/FEATURE-TPS-BADGE.md)。

## 卸载

从托盘完全退出 ZCode，双击 `tools\restore.cmd`（或 `node src/restore.mjs`），再启动 ZCode，徽标就消失了。

## 备用模式（CDP，不改 app.asar）

不想改安装文件、或补丁被 ZCode 升级覆盖时，可以用 `tools\launch-zcode-tps.cmd`：它带 `--remote-debugging-port=9222` 启动 ZCode，再由 `tools\injector.mjs` 通过 CDP 注入同一个徽标，需要 Node.js 22+。

运行期间本机任意进程都能连 9222 控制 ZCode（包括读对话），只建议在自己机器上用。

## 反馈

遇到问题、想要新功能，或者 ZCode 升级后徽标失灵，都可以到 [Issues](https://github.com/MVennn/ZCodeTpsBadge/issues) 反馈。

请带上：

- ZCode 版本号
- `node src/patch.mjs` 的输出
- 复现步骤
- 样式问题附截图

## 免责声明

本项目仅供学习与个人使用。

- 非官方项目，与 ZCode 官方及其关联方无任何隶属、合作、授权或支持关系
- 会修改本地 ZCode 安装目录里的 `app.asar`；ZCode 升级会覆盖补丁，需要重新应用
- 徽标数值是按页面文本估算的，不是模型返回的精确 usage，不用于计费或性能结论
- 不收集、不上传任何数据，不读取对话内容，不修改模型请求
- 使用本项目产生的任何后果由使用者自行承担

「ZCode」商标、标识的权利均归其权利人所有。本项目与之不存在任何隶属、合作、授权、认可或支持关系。

## 开源鸣谢

| 项目 | 用途 |
|---|---|
| ZCode 桌面版 | 宿主应用 |
| [Node.js](https://nodejs.org/) | 补丁、还原、预览与仓库检查脚本 |
| [Pillow](https://python-pillow.org/) | 图标与社交预览生成 |
| [GitHub](https://github.com/) | 代码托管与 CI |

## 许可证

本项目以 [MIT](https://github.com/MVennn/ZCodeTpsBadge/blob/main/LICENSE) 发布。

徽标不收集、不上传任何数据，统计只发生在你的本机。
