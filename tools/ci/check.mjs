#!/usr/bin/env node
// Repository checks: syntax, links, required files, docs orphans, asset sizes,
// stats guards, release-note shape, personal paths and obvious secrets.
//
//   node tools/ci/check.mjs

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'site', '.work', '__pycache__']);

const passed = [];
const problems = [];

const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/');
const fail = (kind, detail) => problems.push(`${kind}: ${detail}`);
const pass = (message) => passed.push(message);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(ROOT);

// 1. JavaScript syntax
const mjsFiles = files.filter((file) => file.endsWith('.mjs'));
for (const file of mjsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    fail('syntax', `${rel(file)}\n${(result.stderr || '').trim()}`);
  }
}
pass(`syntax: ${mjsFiles.length} .mjs files`);

// 2. Required files
const required = [
  'README.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'LICENSE',
  'package.json',
  'config.example.json',
  'assets/icon.svg',
  'assets/logo.png',
  'assets/icon.ico',
  'assets/social-preview.png',
  'docs/README.md',
  'docs/ARCHITECTURE.md',
  'docs/DESIGN.md',
  'docs/FEATURE-TPS-BADGE.md',
  'docs/BUILD.md',
  'docs/RELEASE.md',
  'docs/VERSIONING.md',
  'docs/MAINTENANCE.md',
  'docs/NAMING.md',
  'docs/CODE-RULES.md',
  'docs/REPO-STANDARD.md',
  'docs/DOC-RULES.md',
  'docs/TOOLS-DOC-RULES.md',
  'docs/TROUBLESHOOTING.md',
  'docs/release-notes/README.md',
  'docs/release-notes/0.1.0.md',
  'tools/README.md',
  'tools/ci/check.mjs',
  '.github/workflows/ci.yml',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  '.github/ISSUE_TEMPLATE/feature_request.yml',
  '.github/ISSUE_TEMPLATE/config.yml'
];
for (const file of required) {
  if (!fs.existsSync(path.join(ROOT, file))) fail('required', file);
}
pass(`required files: ${required.length}`);

// 3. Markdown / HTML relative links
function slug(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\- ]/g, '')
    .replace(/\s+/g, '-');
}

let linkCount = 0;
for (const file of files.filter((entry) => entry.endsWith('.md'))) {
  const text = fs.readFileSync(file, 'utf8');
  const targets = [];
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) targets.push(match[1]);
  for (const match of text.matchAll(/(?:src|href)="([^"]+)"/g)) targets.push(match[1]);

  for (const raw of targets) {
    const target = raw.trim();
    if (!target || /^(https?:|mailto:|#|data:)/i.test(target)) continue;

    const [filePart, anchor] = target.split('#');
    if (!filePart) continue;

    const resolved = path.resolve(path.dirname(file), decodeURIComponent(filePart));
    linkCount++;

    if (!fs.existsSync(resolved)) {
      fail('link', `${rel(file)} -> ${target}`);
      continue;
    }

    if (anchor) {
      const destination = fs.readFileSync(resolved, 'utf8');
      const anchors = destination
        .split(/\r?\n/)
        .filter((line) => /^#{1,6}\s/.test(line))
        .map((line) => slug(line.replace(/^#{1,6}\s+/, '')));
      if (!anchors.includes(anchor.toLowerCase())) {
        fail('anchor', `${rel(file)} -> ${target}`);
      }
    }
  }
}
pass(`links: ${linkCount}`);

// 4. docs index / orphan check
const docsDir = path.join(ROOT, 'docs');
const docs = fs.readdirSync(docsDir).filter((name) => name.endsWith('.md') && name !== 'README.md');
const docsIndex = fs.readFileSync(path.join(docsDir, 'README.md'), 'utf8');
for (const doc of docs) {
  if (!docsIndex.includes(doc)) fail('orphan', `docs/${doc} not linked from docs/README.md`);
}
pass(`docs index: ${docs.length} docs`);

// 5. Asset dimensions
function pngSize(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const logo = pngSize(path.join(ROOT, 'assets/logo.png'));
if (!logo || logo.width !== 512 || logo.height !== 512) {
  fail('asset', 'assets/logo.png must be 512x512');
}
const social = pngSize(path.join(ROOT, 'assets/social-preview.png'));
if (!social || social.width !== 1280 || social.height !== 640) {
  fail('asset', 'assets/social-preview.png must be 1280x640');
}
pass('assets: logo 512x512, social 1280x640');

// 6. Data-source guard
// 0.3.0 replaced character estimation with the same session/debug snapshot the
// Developer Tools panel polls. Keep the source of truth pinned: the badge must
// consume `zcode-tps-debug`, and the tap must call the agent channel.
const badgeSrc = fs.readFileSync(path.join(ROOT, 'src/badge-source.mjs'), 'utf8');
for (const [needle, why] of [
  ['zcode-tps-debug', 'debug snapshot message source'],
  ['tokensPerSecond', 'provider-computed TPS from session/debug'],
  ['reasoningTokens', 'reasoning usage surfaced in the tooltip'],
  ['lastRoundPlausible', 'ignore implausible current-round TPS'],
  ['d.plausible', 'read the tap plausibility flag'],
  ["typeof __tpsEventTapSource === 'function'", 'event tap install path must invoke the bound function']
]) {
  if (!badgeSrc.includes(needle)) {
    fail('source', `src/badge-source.mjs: missing ${why} (${needle})`);
  }
}
for (const needle of ['estimateTokens', 'RATE_CAP', 'NOMINAL_RATE', 'domStale', "src: 'zcode-tps-event'"]) {
  if (badgeSrc.includes(needle)) {
    fail('source', `src/badge-source.mjs: character-counting remnant ${needle}`);
  }
}
const tapSrc = fs.readFileSync(path.join(ROOT, 'src/event-source.mjs'), 'utf8');
for (const [needle, why] of [
  ['zcode-agent', 'host channel name'],
  ['readSessionDebug', 'Developer Tools data method'],
  ['zcode:service-port', 'base service port capture'],
  ['encodeFrame', 'request encoder'],
  ["kind: 'activity'", 'generation activity signal'],
  ['update-status', 'skip the update/startup window'],
  ['type === 200', 'wait for the host Initialize frame'],
  ['!portReady', 'do not poll before Initialize'],
  ['isPlausibleRound', 'filter implausible TPS rounds from stats'],
  ['MAX_PLAUSIBLE_TPS', 'TPS outlier cap'],
  ['plausible:', 'forward the current-round plausibility flag']
]) {
  if (!tapSrc.includes(needle)) {
    fail('source', `src/event-source.mjs: missing ${why} (${needle})`);
  }
}
for (const needle of ['COUNTED_PATHS', 'estimateTokens', 'countCjk']) {
  if (tapSrc.includes(needle)) {
    fail('source', `src/event-source.mjs: character-counting remnant ${needle}`);
  }
}
if (/servicePort\.start\s*\(/.test(tapSrc)) {
  fail('source', 'src/event-source.mjs: must not start the service port (steals Initialize)');
}
const rpcTest = spawnSync(process.execPath, [path.join(ROOT, 'tools/ci/test-debug-source.mjs')], {
  encoding: 'utf8'
});
if (rpcTest.status !== 0) {
  fail('source', `tools/ci/test-debug-source.mjs failed\n${(rpcTest.stderr || rpcTest.stdout || '').trim()}`);
}
pass('source guard: session/debug only, RPC shape test');

// 7. Release notes shape
// 口径正本见 docs/release-notes/README.md：清单，不是文章。
const notesDir = path.join(ROOT, 'docs/release-notes');
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
if (!fs.existsSync(path.join(notesDir, `${version}.md`))) {
  fail('release-notes', `docs/release-notes/${version}.md missing for package.json version`);
}
const noteVerbs = ['新增', '调整', '修复', '优化', '移除'];
const noteFiles = fs.readdirSync(notesDir).filter((name) => /^\d+\.\d+\.\d+\.md$/.test(name));
for (const name of noteFiles) {
  const label = `docs/release-notes/${name}`;
  const text = fs.readFileSync(path.join(notesDir, name), 'utf8');
  if (!text.startsWith('**')) fail('release-notes', `${label}: first line must be a bold summary`);
  if (!text.includes('## 本版内容')) fail('release-notes', `${label}: missing "## 本版内容"`);
  if (!text.includes('> 风险提示：')) fail('release-notes', `${label}: missing fixed risk notice`);
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('- ')) continue;
    if (!noteVerbs.some((verb) => line.startsWith(`- ${verb} `))) {
      fail('release-notes', `${label}: item must start with ${noteVerbs.join(' / ')}: ${line}`);
    }
  }
}
pass(`release notes: ${noteFiles.length} files, shape + fixed tail`);

// 8. Personal paths / secrets
const skip = new Set(['tools/ci/check.mjs', 'config.local.json', 'PROGRESS.md']);
const textExtensions = /\.(md|mjs|js|json|cmd|vbs|py|yml|yaml|txt|svg|gitignore|gitattributes)$/;
const personalName = 'Sans' + 'K';
const patterns = [
  { re: new RegExp('\\b' + personalName + '\\b'), label: 'personal username' },
  // 放行占位用户名与「截断形式」的描述性引用（对齐 8 仓统一的脱敏规则）：
  // You / Your / <...> / ... 都不算本机路径，完整路径一律拦。
  { re: /[A-Za-z]:[\\/]Users[\\/](?!You\b|Your\b|<|\.\.\.)/i, label: 'absolute user path' },
  { re: /gho_[A-Za-z0-9]{20,}/, label: 'github token' },
  { re: /github_pat_[A-Za-z0-9_]{20,}/, label: 'github token' },
  { re: /sk-[A-Za-z0-9]{20,}/, label: 'api key' },
  { re: /BEGIN (RSA|OPENSSH|EC) PRIVATE KEY/, label: 'private key' }
];

for (const file of files) {
  const name = rel(file);
  if (skip.has(name) || !textExtensions.test(name)) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of patterns) {
    if (pattern.re.test(text)) fail('privacy', `${name}: ${pattern.label}`);
  }
}
pass('privacy: no personal paths or obvious secrets');

// Report
for (const line of passed) console.log('ok   ' + line);

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.error('  - ' + problem);
  process.exit(1);
}

console.log('\nall checks passed');
