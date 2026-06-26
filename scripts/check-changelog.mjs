#!/usr/bin/env node

import { execSync } from 'node:child_process';

function listChangedFiles() {
  const output = execSync('git status --porcelain', { encoding: 'utf8' });
  return output
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^.. /, '').replace(/^"|"$/g, ''));
}

const changedFiles = listChangedFiles();
const ignored = new Set([
  'CHANGELOG.md',
  'AGENTS.md',
  'scripts/check-changelog.mjs'
]);

const meaningfulChanges = changedFiles.filter((file) => !ignored.has(file));
const changelogChanged = changedFiles.includes('CHANGELOG.md');

if (meaningfulChanges.length > 0 && !changelogChanged) {
  console.error('Chybí záznam v CHANGELOG.md pro aktuální změny.');
  console.error('Upravené soubory:');
  for (const file of meaningfulChanges) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log('Changelog kontrola OK.');
