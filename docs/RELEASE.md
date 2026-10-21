# 发布清单

> **一句话**：源码型工具的发布 = 版本号 + CHANGELOG + release note + tag + GitHub Release；
> 不发二进制、不发本机配置。

---

## 1. 发版前

1. 确认这次改动已经 commit，工作区干净。
2. 按 [VERSIONING.md](VERSIONING.md) 判断进位，改 `package.json` 的 `version`。
3. 把 `CHANGELOG.md` 的 `[未发布]` 改成 `[X.Y.Z] — YYYY-MM-DD`。
4. 新建 `docs/release-notes/X.Y.Z.md`（格式见 [release-notes/README.md](release-notes/README.md)）。
5. 更新 README 里的版本徽章（`version-X.Y.Z`）。
6. 跑检查：

   ```bash
   npm run check
   node src/patch.mjs          # 干跑
   ```

7. 完全退出 ZCode，重新 apply 一次，确认补丁可重建：

   ```bash
   npm run patch
   ```

8. 完全重启 ZCode，确认徽标与悬停卡正常。没验就明说没验。

## 2. 打 tag

```bash
git add -A
git commit -m "release: vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin main
git push origin vX.Y.Z
```

tag 必须与 `package.json` 的 `version` 一致。

## 3. GitHub Release

```bash
gh release create vX.Y.Z \
  --title "vX.Y.Z" \
  --notes-file docs/release-notes/X.Y.Z.md
```

- 仓库是源码型工具，**不附带 APK / exe / zip**；
- Release 说明面向用户，写「新增 / 修复 / 升级注意 / 验证」；
- 风险提示固定包含：非官方、会修改 `app.asar`、ZCode 升级后需重新 apply、
  徽标数值是估算值。

## 4. 发版后

- 确认 README 的 CI 与版本徽章正常；
- 用干净 clone 跑一次 `npm run check`；
- 在 Release 里确认 `docs/release-notes/` 的链接可点；
- 若发现文案 / 链接错误，走补丁版本 `+0.0.1`，不要移动已发布的 tag。
