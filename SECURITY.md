# 安全

> **一句话**：这个项目只做本地界面注入；报告问题时不要贴 token、cookie、完整对话或本机用户名路径。

## 报告问题

- 优先使用 GitHub 的 **Security Advisory**（私密报告）；
- 一般问题可以开 Issue，但请先删掉敏感信息：
  - ZCode / GitHub / 模型供应商的 token、cookie、API key；
  - 完整对话内容；
  - 本机用户名路径（用 `<你的路径>` 代替）。

## 范围

- 徽标只读取 ZCode 内部调试快照里的 token usage 数值（与开发者工具「Token 调试」
  同源），不读取、不保存对话文本；
- 不发起网络请求、不上传数据；
- 补丁只修改本地 `resources/app.asar` 的头部与外部 preload；
- 备用 CDP 模式只监听 `127.0.0.1:9222`，运行期间本机进程可控制 ZCode，
  只建议在自己机器上使用。

## 支持版本

只维护 `main` 分支与最新 Release；旧版本的问题请先升级再复现。
