// Resolve the ZCode installation paths.
//
// Priority:
//   1. ZCODE_RESOURCES / ZCODE_EXE environment variables
//   2. config.local.json in the project root (gitignored)
//   3. %LOCALAPPDATA%\Programs\ZCode\resources
//
// config.local.json example:
//   { "zcodeResources": "D:/Apps/ZCode/resources", "zcodeExe": "D:/Apps/ZCode/ZCode.exe" }

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localConfigPath = path.join(root, 'config.local.json');

function readLocalConfig() {
  try {
    return JSON.parse(fs.readFileSync(localConfigPath, 'utf8'));
  } catch {
    return {};
  }
}

const local = readLocalConfig();
const fallbackResources = path.join(
  process.env.LOCALAPPDATA || '',
  'Programs',
  'ZCode',
  'resources'
);

export const ZCODE_RESOURCES = path.resolve(
  process.env.ZCODE_RESOURCES || local.zcodeResources || fallbackResources
);

export const ZCODE_EXE = path.resolve(
  process.env.ZCODE_EXE || local.zcodeExe || path.join(path.dirname(ZCODE_RESOURCES), 'ZCode.exe')
);
