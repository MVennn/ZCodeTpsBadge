// Print a resolved ZCode path, for scripts and launchers.
//
//   node src/which.mjs resources   -> ...\ZCode\resources
//   node src/which.mjs exe         -> ...\ZCode\ZCode.exe

import { ZCODE_EXE, ZCODE_RESOURCES } from './config.mjs';

const what = (process.argv[2] || 'resources').toLowerCase();

if (what === 'resources') {
  console.log(ZCODE_RESOURCES);
} else if (what === 'exe') {
  console.log(ZCODE_EXE);
} else {
  console.error('usage: node src/which.mjs [resources|exe]');
  process.exit(1);
}
