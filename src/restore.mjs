#!/usr/bin/env node
// Restore ZCode's app.asar after src/patch.mjs.
//   node src/restore.mjs            # restore
//   node src/restore.mjs --dry-run  # run every check, write nothing
// ZCode must be fully quit. Paths resolve via src/config.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ZCODE_RESOURCES } from './config.mjs';

const ASAR = path.join(ZCODE_RESOURCES, 'app.asar');
const UNPACKED = path.join(ZCODE_RESOURCES, 'app.asar.unpacked');
const TARGET = 'out/preload/index.cjs';
const BACKUP = ASAR + '.header.tps-bak';
const DRY_RUN = process.argv.includes('--dry-run');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('usage: node src/restore.mjs [--dry-run]');
  console.log('  --dry-run        run every check, write nothing');
  console.log('  ZCODE_RESOURCES  override the ZCode resources directory');
  process.exit(0);
}

if (!fs.existsSync(ASAR)) {
  console.error('app.asar not found: ' + ASAR);
  console.error('Set ZCODE_RESOURCES to the ZCode "resources" directory.');
  process.exit(1);
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function nodeAt(root, p) {
  return p.split('/').reduce((a, k) => (a && a.files ? a.files[k] : undefined), root);
}

/** 把头部里的叶子条目摊平成 { 路径: entry }，用于逐条比对。 */
function flatten(node, out = {}, prefix = '') {
  for (const [name, child] of Object.entries(node.files || {})) {
    const p = prefix ? prefix + '/' + name : name;
    if (child && child.files) flatten(child, out, p);
    else out[p] = child;
  }
  return out;
}

const norm = (v) => (v === undefined || v === null ? '' : String(v));

/**
 * 备份头是否属于当前这个 asar。
 *
 * 只比长度不够：跨 ZCode 版本 apply/restore 时旧备份也能通过长度检查
 * （头部长度由字段数决定，常撞上），但写回去会让头里所有 offset 错位，
 * asar 直接损坏。除目标文件外，每个条目的 offset / size / integrity 都必须一致。
 *
 * @returns 第一个不一致的路径，全部一致时返回 null
 */
function ownershipMismatch(backupRoot, currentRoot) {
  const a = flatten(backupRoot);
  const b = flatten(currentRoot);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (k === TARGET) continue;
    const x = a[k];
    const y = b[k];
    if (!x || !y) return k;
    if (norm(x.offset) !== norm(y.offset)) return k;
    if (norm(x.size) !== norm(y.size)) return k;
    if (!!x.unpacked !== !!y.unpacked) return k;
    const ia = x.integrity && x.integrity.blocks ? norm(x.integrity.blocks[0]) : '';
    const ib = y.integrity && y.integrity.blocks ? norm(y.integrity.blocks[0]) : '';
    if (ia !== ib) return k;
  }
  return null;
}

let running = false;
try {
  const out = execFileSync('tasklist', [
    '/FI', 'IMAGENAME eq ZCode.exe', '/NH', '/FO', 'CSV'
  ], { encoding: 'utf8' });
  running = /"ZCode\.exe"/i.test(out);
} catch (err) {
  if (err.status !== 1) fail('Could not check whether ZCode is running: ' + err.message);
}
if (running && !DRY_RUN) fail('ZCode is running. Quit it completely from the tray first.');

if (!fs.existsSync(BACKUP)) fail('Header backup not found: ' + BACKUP);

const fd = fs.openSync(ASAR, 'r+');
const head = Buffer.alloc(16);
fs.readSync(fd, head, 0, 16, 0);
const jsonSize = head.readUInt32LE(12);
const headerBuf = Buffer.alloc(jsonSize);
fs.readSync(fd, headerBuf, 0, jsonSize, 16);

const backup = fs.readFileSync(BACKUP);
if (backup.length !== jsonSize) {
  fs.closeSync(fd);
  fail(`Backup size mismatch: ${backup.length} vs current header ${jsonSize}.`);
}

let backupRoot;
let currentRoot;
try {
  backupRoot = JSON.parse(backup.toString('utf8').replace(/\u0000+$/, ''));
  currentRoot = JSON.parse(headerBuf.toString('utf8').replace(/\u0000+$/, ''));
} catch (err) {
  fs.closeSync(fd);
  fail('Could not parse asar header: ' + err.message);
}

const backupTarget = nodeAt(backupRoot, TARGET);
if (!backupTarget || backupTarget.unpacked || backupTarget.offset == null) {
  fs.closeSync(fd);
  fail('备份头里没有可还原的 ' + TARGET + '（可能备份本身就取自已打补丁的状态）');
}

const mismatch = ownershipMismatch(backupRoot, currentRoot);
if (mismatch) {
  fs.closeSync(fd);
  fail(`备份不属于当前 ZCode 版本（首个不一致条目：${mismatch}）。\n`
    + '  跨版本还原会把 asar 头里的 offset 全部写错，请不要继续。\n'
    + '  处理方式：重装 ZCode，或重新运行 tools/apply.cmd 后再还原。');
}

if (DRY_RUN) {
  fs.closeSync(fd);
  console.log('dry run: 备份与当前 asar 同源，可以还原（未写入任何字节）');
  process.exit(0);
}

let written = 0;
while (written < backup.length) {
  written += fs.writeSync(fd, backup, written, backup.length - written, 16 + written);
}
fs.fsyncSync(fd);
fs.closeSync(fd);

// 写回后自检：头部能解析、目标条目已恢复成普通条目。
const vfd = fs.openSync(ASAR, 'r');
const vhead = Buffer.alloc(16);
fs.readSync(vfd, vhead, 0, 16, 0);
const vjsonSize = vhead.readUInt32LE(12);
const vbuf = Buffer.alloc(vjsonSize);
fs.readSync(vfd, vbuf, 0, vjsonSize, 16);
fs.closeSync(vfd);
let vroot;
try {
  vroot = JSON.parse(vbuf.toString('utf8').replace(/\u0000+$/, ''));
} catch (err) {
  fail('还原后头部无法解析，请重装 ZCode：' + err.message);
}
const vtarget = nodeAt(vroot, TARGET);
if (!vtarget || vtarget.unpacked || vtarget.offset == null) {
  fail('还原后 ' + TARGET + ' 仍不是普通条目，请重装 ZCode。');
}

const external = path.join(UNPACKED, TARGET);
if (fs.existsSync(external)) {
  try {
    fs.unlinkSync(external);
    console.log('removed ' + external);
  } catch (err) {
    fail(`无法删除外部 preload：${external}\n  ${err.message}\n  请手动删除该文件后重试。`);
  }
}

console.log('Restored asar header from ' + BACKUP);
console.log('Launch ZCode normally. The badge is gone; the backup file can be deleted.');
