#!/usr/bin/env node
// Repository checks: syntax, links, required files, docs orphans, asset sizes,
// personal paths and obvious secrets.
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
  'assets/screenshot-dark.png',
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

// 6. Personal paths / secrets
const skip = new Set(['tools/ci/check.mjs', 'config.local.json', 'PROGRESS.md']);
const textExtensions = /\.(md|mjs|js|json|cmd|vbs|py|yml|yaml|txt|svg|gitignore|gitattributes)$/;
const personalName = 'Sans' + 'K';
const patterns = [
  { re: new RegExp('\\b' + personalName + '\\b'), label: 'personal username' },
  { re: /[A-Za-z]:[\\/]Users[\\/](?!You\b|Your\b|<)/i, label: 'absolute user path' },
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
