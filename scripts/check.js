'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

function checkDirectory(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'dist', 'coverage'].includes(entry.name)) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) checkDirectory(filename);
    else if (filename.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', filename], { stdio: 'inherit' });
      if (result.status !== 0) process.exit(result.status || 1);
    }
  }
}

checkDirectory(root);
const metadata = JSON.parse(fs.readFileSync(path.join(root, 'info.json')));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
if (metadata.version !== manifest.version || metadata.id !== manifest.name) {
  throw new Error('Extension metadata must match the package name and version.');
}
if (metadata.gameId !== 3428) {
  throw new Error('info.json.gameId must be the numerical Nexus ID 3428 for Re-Reckoning.');
}
console.log('JavaScript syntax and extension metadata checked.');
