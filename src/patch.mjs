#!/usr/bin/env node
// Patch ZCode's app.asar so the tok/s badge is injected on every launch.
//
//   node src/patch.mjs          # dry run (read-only)
//   node src/patch.mjs --apply  # write; ZCode must be fully quit
//   node src/patch.mjs --apply --force  # write even while ZCode runs
//     (header stays the same length and no data offset moves, so a running
//      instance is unaffected; the badge shows up on the next launch)
//
// ZCode paths resolve via src/config.mjs:
//   ZCODE_RESOURCES env -> config.local.json -> %LOCALAPPDATA%\Programs\ZCode\resources
//
// How it works:
//   1. Mark out/preload/index.cjs as "unpacked" in the asar header.
//   2. Copy that file to resources/app.asar.unpacked/out/preload/index.cjs
//      and append the badge script.
//   3. Electron then loads the external copy on every launch.
//   4. The header keeps its exact byte length, so all data offsets stay valid.
//
// Restore with src/restore.mjs.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { badgeSource } from './badge-source.mjs';
import { ZCODE_RESOURCES } from './config.mjs';

const ASAR = path.join(ZCODE_RESOURCES, 'app.asar');
const UNPACKED = path.join(ZCODE_RESOURCES, 'app.asar.unpacked');
const TARGET = 'out/preload/index.cjs';
const BACKUP = ASAR + '.header.tps-bak';
const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('usage: node src/patch.mjs [--apply] [--force]');
  console.log('  (no flags)  dry run, read-only');
  console.log('  --apply     write the patch (ZCode should be fully quit)');
  console.log('  --force     allow --apply while ZCode is running');
  console.log('  ZCODE_RESOURCES  override the ZCode resources directory');
  process.exit(0);
}

if (!fs.existsSync(ASAR)) {
  console.error('app.asar not found: ' + ASAR);
  console.error('Set ZCODE_RESOURCES to the ZCode "resources" directory.');
  process.exit(1);
}

function fail(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function zcodeRunning() {
  try {
    const out = execFileSync('tasklist', [
      '/FI', 'IMAGENAME eq ZCode.exe', '/NH', '/FO', 'CSV'
    ], { encoding: 'utf8' });
    return /"ZCode\.exe"/i.test(out);
  } catch (err) {
    if (err.status === 1) return false;
    throw err;
  }
}

function nodeAt(root, p) {
  return p.split('/').reduce((a, k) => (a && a.files ? a.files[k] : undefined), root);
}

function readHeader(fd) {
  const head = Buffer.alloc(16);
  fs.readSync(fd, head, 0, 16, 0);
  const jsonSize = head.readUInt32LE(12);
  const buf = Buffer.alloc(jsonSize);
  fs.readSync(fd, buf, 0, jsonSize, 16);
  return { jsonSize, buf, text: buf.toString('utf8') };
}

if (APPLY) {
  try {
    if (zcodeRunning()) {
      if (!FORCE) fail('ZCode is running. Quit it completely from the tray first (or pass --force).');
      console.warn('ZCode is running; applying anyway (badge appears after the next full restart).');
    }
  } catch (err) {
    fail('Could not check whether ZCode is running: ' + err.message);
  }
}

const fd = fs.openSync(ASAR, APPLY ? 'r+' : 'r');
const { jsonSize, buf: headerBuf, text } = readHeader(fd);
let root;
try {
  root = JSON.parse(text.replace(/\u0000+$/, ''));
} catch (err) {
  fs.closeSync(fd);
  fail('Could not parse asar header: ' + err.message);
}

const entry = nodeAt(root, TARGET);
if (!entry) {
  fs.closeSync(fd);
  fail('Target not found in asar: ' + TARGET, 2);
}

const dataBase = 18 + jsonSize;
let originalSize;
let original;

if (entry.unpacked) {
  // Rebuilding: the original bytes still sit in the asar at the offset recorded
  // in the header backup (the patched header dropped that offset).
  if (!fs.existsSync(BACKUP)) {
    fs.closeSync(fd);
    fail('Already patched, but the header backup is missing: ' + BACKUP, 4);
  }
  let backupRoot;
  try {
    backupRoot = JSON.parse(fs.readFileSync(BACKUP, 'utf8').replace(/\u0000+$/, ''));
  } catch (err) {
    fs.closeSync(fd);
    fail('Could not parse header backup: ' + err.message, 4);
  }
  const originalEntry = nodeAt(backupRoot, TARGET);
  if (!originalEntry || originalEntry.unpacked || originalEntry.offset == null) {
    fs.closeSync(fd);
    fail('Header backup has no plain entry for ' + TARGET, 4);
  }
  originalSize = originalEntry.size;
  original = Buffer.alloc(originalSize);
  fs.readSync(fd, original, 0, originalSize, dataBase + Number(originalEntry.offset));
  console.log('Already patched; rebuilding the external preload with the current badge source.');
} else {
  originalSize = entry.size;
  original = Buffer.alloc(originalSize);
  fs.readSync(fd, original, 0, originalSize, dataBase + Number(entry.offset));
}

const tail = `\n;(${badgeSource.toString()})();\n`;
const patched = Buffer.concat([original, Buffer.from(tail, 'utf8')]);

entry.size = patched.length;
entry.unpacked = true;
delete entry.offset;
const hash = crypto.createHash('sha256').update(patched).digest('hex');
entry.integrity = { algorithm: 'SHA256', hash, blockSize: 4194304, blocks: [hash] };

const newText = JSON.stringify(root);
let newBuf = Buffer.from(newText, 'utf8');
if (newBuf.length > jsonSize) {
  fs.closeSync(fd);
  fail(`Header grew too much: ${newBuf.length} > ${jsonSize} bytes`, 3);
}
newBuf = Buffer.concat([newBuf, Buffer.alloc(jsonSize - newBuf.length, 0x20)]);

console.log('asar:          ' + ASAR);
console.log('target:        ' + TARGET);
console.log('original size: ' + originalSize + ' bytes');
console.log('patched size:  ' + patched.length + ' bytes (+' + (patched.length - originalSize) + ')');
console.log('header:        ' + jsonSize + ' bytes (kept, padded with spaces)');
console.log('external file: ' + path.join(UNPACKED, TARGET));
console.log('first bytes:   ' + JSON.stringify(original.toString('utf8', 0, 40)));

if (!APPLY) {
  fs.closeSync(fd);
  console.log('\nDry run only. Quit ZCode, then run: node src/patch.mjs --apply');
  process.exit(0);
}

fs.mkdirSync(path.dirname(path.join(UNPACKED, TARGET)), { recursive: true });
const external = path.join(UNPACKED, TARGET);
const tmpExternal = external + '.tmp-' + process.pid;
fs.writeFileSync(tmpExternal, patched);
fs.renameSync(tmpExternal, external);
if (!fs.existsSync(BACKUP)) fs.writeFileSync(BACKUP, headerBuf);
let written = 0;
while (written < newBuf.length) {
  written += fs.writeSync(fd, newBuf, written, newBuf.length - written, 16 + written);
}
fs.closeSync(fd);

const vfd = fs.openSync(ASAR, 'r');
const v = readHeader(vfd);
const vroot = JSON.parse(v.text.replace(/\u0000+$/, ''));
const ventry = nodeAt(vroot, TARGET);
fs.closeSync(vfd);

const externalSize = fs.statSync(path.join(UNPACKED, TARGET)).size;
console.log('\nApplied.');
console.log('verified: unpacked=' + ventry.unpacked + ' size=' + ventry.size + ' external=' + externalSize);
console.log('header backup: ' + BACKUP);
console.log('Launch ZCode normally; the badge should appear.');
