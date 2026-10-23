import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const [archive] = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json'], { encoding: 'utf8' }));
for (const example of ['react-vite', 'nextjs']) {
  const directory = `examples/${example}`;
  const manifestPath = `${directory}/package.json`;
  const lockPath = `${directory}/package-lock.json`;
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const lock = JSON.parse(await readFile(lockPath, 'utf8'));
  const relative = `file:../../${archive.filename}`;
  assert(manifest.dependencies[pkg.name], `${example}: update the package name in example dependencies first`);
  const entry = lock.packages[`node_modules/${pkg.name}`];
  assert(entry, `${example}: missing local package lock entry`);
  manifest.dependencies[pkg.name] = relative;
  lock.packages[''].dependencies[pkg.name] = relative;
  entry.version = pkg.version;
  entry.resolved = relative;
  entry.integrity = archive.integrity;
  entry.dependencies = pkg.dependencies;
  entry.peerDependencies = pkg.peerDependencies;
  entry.engines = pkg.engines;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
}
console.log(`Prepared ${archive.filename}; refreshed only local-package lock entries for both examples.`);
