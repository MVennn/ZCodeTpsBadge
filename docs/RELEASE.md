# 发布清单

> **一句话**：发版 = 版本号 + CHANGELOG + Release 说明 + tag + GitHub Release；
> 源码型工具不附二进制，说明按 [release-notes/README.md](release-notes/README.md)
> 的清单口径写。

> **2026-10-21 起**：Release 说明从「版本叙事」改成「清单」—— 一行一条
> （新增 / 调整 / 修复 / 优化 / 移除），不再整段搬 CHANGELOG。为什么见 §1.1。

---

## 0. 发版发的是什么

| 发什么 | 说明 |
|---|---|
| GitHub Release | 正文 = `docs/release-notes/<version>.md`，逐字一致 |
| tag | `vX.Y.Z`，与 `package.json` 的 `version` 一致 |
| 源码归档 | GitHub 自动生成，不用上传 |

**不附** exe / zip / 安装包 —— 用户装的是源码 + `tools/apply.cmd`；
**不发**本机配置（`config.local.json` 已 gitignore）。

三处版本号必须一致：`package.json`、tag、`docs/release-notes/X.Y.Z.md` 文件名
（门面 README 不挂版本徽章，不在此列）。
进位规则见 [VERSIONING.md](VERSIONING.md)。

---

## 1. 发版

```bash
# 0. 工作区干净，仓库检查先跑一遍
git status --short
npm run check

# 1. 改版本号（按 VERSIONING 判断进位）
#    package.json 的 version
#    CHANGELOG.md 的 [未发布] → [X.Y.Z] — YYYY-MM-DD
#    docs/release-notes/X.Y.Z.md（格式见 release-notes/README.md）

# 2. 干跑 + 实际重建补丁，确认补丁可复现
node src/patch.mjs
npm run patch

# 3. 完全退出 ZCode（托盘 → 退出），重新启动，确认徽标与悬停卡正常
#    没验就明说没验

# 4. 提交并打 tag
git add -A
git commit -m "release: vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin main
git push origin vX.Y.Z

# 5. 建 Release（正文直接用说明文件）
gh release create vX.Y.Z --title "vX.Y.Z" \
  --notes-file docs/release-notes/X.Y.Z.md
```

> **说明定稿再发，一次发版只建一次 Release。** 发完才发现错字，用
> `gh release edit vX.Y.Z --notes-file ...` 补**一次**，不要短时间反复改（§3.1）。

## 1.1 Release 说明怎么写

**正本是 [release-notes/README.md](release-notes/README.md)**，本节只留三条最容易跑偏的：

- **CHANGELOG 是开发者记录，不要整段当 Release 说明。** 症状 / 根因 / 改法 /
  验证结果 / 构建细节留给 CHANGELOG；用户看到的应该是「这版我能拿到什么」。
- **清单，不是文章。** 开头一句加粗，`## 本版内容` 下按对象分组，一行一条：
  `新增 / 调整 / 修复 / 优化 / 移除 + 功能名 —— 入口；一句话`。
- **覆盖率红线：本版全部用户可感知改动必须进说明**，一条不漏；
  纯重构、删死代码、内部修复也算「修复」，写用户可见的后果，不写根因。

固定尾巴（要求行 + 安装链接 + 风险提示）每版逐字照抄，不随版本改写。

---

## 2. 发版前检查

- [ ] 工作区干净（`git status --short` 无输出）
- [ ] `package.json` 的 `version` 已递增（进位规则见 [VERSIONING.md](VERSIONING.md)）
- [ ] `CHANGELOG.md` 顶部已加该版本的段落
- [ ] `docs/release-notes/<version>.md` 已按清单口径写完，并拿 CHANGELOG 逐条对过
- [ ] `npm run check` 全绿
- [ ] `node src/patch.mjs` 干跑正常；`npm run patch` 重建成功
- [ ] 完全退出并重启 ZCode，徽标与悬停卡正常（没验就写清楚没验）
- [ ] **没有正在进行的在途开发** —— 否则发出去的是下一个未完工的版本

## 3. 发版后

- [ ] 打开 Release 页，确认标题是 `vX.Y.Z`、正文与说明文件逐字一致
- [ ] 用干净 clone 跑一次 `npm run check`
- [ ] README 顶部的 logo 与徽章行正常显示（效果截图已移除）
- [ ] 线上说明里的链接可点（尤其是 README 的 `#安装` 锚点）

文案或链接错了：改说明文件后 `gh release edit` 覆盖线上正文；
**不要移动或删除已发布的 tag**。需要重发代码就走补丁版本 `+0.0.1`。

## 3.1 推送节奏与账号风控

2026-10-18 账号曾被 GitHub 停用（短时间内反复起构建），10-21 解封。
恢复之后按下面四条走：

1. **攒批推，别一提交一推。** 一个工作日或一个版本推一次；推之前先
   `git status --short` 看一眼，别把并发会话的改动一起吞进去。
2. **不改写已推历史。** 不用 `push --force` / `--force-with-lease`，
   不 rebase 远端已有的提交。
3. **Release 说明定稿再发。** 同一份说明不要一小时里连改三次 —— 从 API 看
   就是「同一个 Release 短时间反复写」。
4. **CI 只跑轻量检查。** 本仓库的 CI 是 `node --check` + 链接 / 文档检查，
   不在短时间反复重跑，也不把发版挂到 CI 上。

---

## 4. 几个坑

- **tag 与 `package.json` 不一致** → Release 挂在错的版本上；发版前用
  `git tag -l` 与 `package.json` 对一遍。
- **把 CHANGELOG 当说明发** → 用户看到的是根因、构建细节和验证表格，是噪音；
  说明文件缺失时不要用 `gh release create` 的空正文兜底，先补文件。
- **移动已发布 tag** → 已经有人下载过的 Release 会对不上；文案错只改说明。
- **附二进制** → 本仓库是源码型工具，Release 只放说明，不放 exe / zip。
- **ZCode 升级覆盖 `app.asar`** → 补丁需要重新 apply；这条已写进固定尾巴，
  不在每版说明里重复。
- **本机路径 / 配置** → `config.local.json`、`PROGRESS.md` 不随仓库分发；
  `npm run check` 会扫本机用户名路径与明显密钥。
