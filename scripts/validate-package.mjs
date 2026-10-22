import { readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
for (const [name, entry] of Object.entries(pkg.exports)) {
  await access(entry.import); await access(entry.types);
  assert.match(await readFile(entry.import, 'utf8'), /^['"]use client['"]/u, `${name}: missing use client`);
}
const [archive] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], { encoding: 'utf8' }));
for (const file of archive.files) {
  assert.match(file.path, /^(dist\/|package\.json$|README(?:\.en)?\.md$|CHANGELOG\.md$|LICENSE$)/u, `Unexpected package file: ${file.path}`);
}
for (const required of ['README.md', 'README.en.md', 'CHANGELOG.md', 'LICENSE']) assert(archive.files.some(f => f.path === required), `Missing ${required}`);
console.log(`Validated ${Object.keys(pkg.exports).length} exports and ${archive.files.length} package files (${archive.size} bytes compressed).`);
