# Release notes

> **一句话**：面向用户的版本说明，一个版本一篇，文件名 = `X.Y.Z.md`。

## 格式

```markdown
# X.Y.Z — YYYY-MM-DD

一句话总结这次版本。

## 新增

- …

## 修复

- …

## 升级注意

- 从托盘完全退出 ZCode，重新运行 `tools/apply.cmd`。
- ZCode 升级会覆盖 `app.asar`，补丁需要重新应用。

## 验证

- 在 ZCode x.y.z 上验证了 …；没验证的写清楚没验证。

## 已知限制

- …
```

## 规则

- 只写用户能感知的内容，不写内部调试细节；
- 「升级注意」固定包含：非官方、会修改 `app.asar`、ZCode 升级后需重新 apply、
  徽标数值是估算值；
- 文件名与 `package.json` 的 `version`、git tag 一致；
- 发版流程见 [RELEASE.md](../RELEASE.md)。
