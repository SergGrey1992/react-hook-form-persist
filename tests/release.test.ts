// @vitest-environment node
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
const script = resolve('scripts/check-release.mjs');
function run(name: string, version = '0.1.0', changelog = '## 0.1.0\nInitial release') {
  const cwd = mkdtempSync(join(tmpdir(), 'persist-release-test-'));
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name, version, repository: { type: 'git', url: 'git+https://github.com/test-owner/test-repository.git' }, homepage: 'https://github.com/test-owner/test-repository', bugs: { url: 'https://github.com/test-owner/test-repository/issues' } }));
  writeFileSync(join(cwd, 'CHANGELOG.md'), changelog);
  return spawnSync(process.execPath, [script, '0.1.0'], { cwd, encoding: 'utf8' });
}
it('blocks placeholder scope before publication', () => { const result = run('@your-scope/react-hook-form-persist'); expect(result.status).not.toBe(0); expect(result.stderr).toContain('placeholder'); });
it('blocks version mismatch', () => { const result = run('test-persist', '0.2.0'); expect(result.status).not.toBe(0); expect(result.stderr).toContain('version'); });
it('requires release notes', () => { const result = run('test-persist', '0.1.0', '# Changelog'); expect(result.status).not.toBe(0); expect(result.stderr).toContain('CHANGELOG'); });
it('accepts matching metadata and release notes', () => { expect(run('test-persist').status).toBe(0); });
