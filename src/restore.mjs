#!/usr/bin/env node
// Restore ZCode's app.asar after src/patch.mjs.
//   node src/restore.mjs
// ZCode must be fully quit. Paths resolve via src/config.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ZCODE_RESOURCES } from './config.mjs';

const ASAR = path.join(ZCODE_RESOURCES, 'app.asar');
const UNPACKED = path.join(ZCODE_RESOURCES, 'app.asar.unpacked');
const TARGET = 'out/preload/index.cjs';
const BACKUP = ASAR + '.header.tps-bak';

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('usage: node src/restore.mjs');
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

let running = false;
try {
  const out = execFileSync('tasklist', [
    '/FI', 'IMAGENAME eq ZCode.exe', '/NH', '/FO', 'CSV'
  ], { encoding: 'utf8' });
  running = /"ZCode\.exe"/i.test(out);
} catch (err) {
  if (err.status !== 1) fail('Could not check whether ZCode is running: ' + err.message);
}
if (running) fail('ZCode is running. Quit it completely from the tray first.');

if (!fs.existsSync(BACKUP)) fail('Header backup not found: ' + BACKUP);

const fd = fs.openSync(ASAR, 'r+');
const head = Buffer.alloc(16);
fs.readSync(fd, head, 0, 16, 0);
const jsonSize = head.readUInt32LE(12);
const backup = fs.readFileSync(BACKUP);
if (backup.length !== jsonSize) {
  fs.closeSync(fd);
  fail(`Backup size mismatch: ${backup.length} vs current header ${jsonSize}.`);
}
let written = 0;
while (written < backup.length) {
  written += fs.writeSync(fd, backup, written, backup.length - written, 16 + written);
}
fs.closeSync(fd);

const external = path.join(UNPACKED, TARGET);
try {
  fs.unlinkSync(external);
  console.log('removed ' + external);
} catch {}

console.log('Restored asar header from ' + BACKUP);
console.log('Launch ZCode normally. The badge is gone; the backup file can be deleted.');
