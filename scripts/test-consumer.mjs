import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const root = process.cwd();
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const [pack] = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json'], { encoding: 'utf8' }));
const archive = resolve(pack.filename);
for (const reactVersion of (process.env.CONSUMER_REACT ? [process.env.CONSUMER_REACT] : ['18', '19'])) {
  const directory = await mkdtemp(join(tmpdir(), `persist-consumer-react${reactVersion}-`));
  console.log(`Consumer React ${reactVersion}: ${directory}`);
  await writeFile(join(directory, 'package.json'), JSON.stringify({ name: 'persist-consumer', private: true, type: 'module' }));
  execFileSync('npm', ['install', '--no-audit', '--no-fund', archive, `react@${reactVersion}`, `react-dom@${reactVersion}`, 'react-hook-form@7.55.0', `@types/react@${reactVersion}`, `@types/react-dom@${reactVersion}`, '@testing-library/react', 'jsdom', 'fake-indexeddb'], { cwd: directory, stdio: 'inherit' });
  const imports = Object.keys(pkg.exports).map((entry, i) => `import { usePersistForm as hook${i} } from '${pkg.name}${entry === '.' ? '' : entry.slice(1)}';`).join('\n');
  await writeFile(join(directory, 'consumer.tsx'), `${imports}
import { useForm } from 'react-hook-form';
export function Consumer() {
  const form = useForm<{ nested: { name: string } }>({ defaultValues: { nested: { name: '' } } });
  ${Object.keys(pkg.exports).map((_, i) => `hook${i}({ form, key: 'typed', exclude: ['nested.name'] });`).join('\n')}
  // @ts-expect-error incorrect field path must be rejected in the installed declarations
  hook0({ form, key: 'typed', exclude: ['does.not.exist'] });
  return null;
}
`);
  execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--jsx', 'react-jsx', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022', 'consumer.tsx'], { cwd: directory, stdio: 'inherit' });
  await writeFile(join(directory, 'local.ts'), `export { usePersistForm } from '${pkg.name}/local';`);
  const bundle = await build({ entryPoints: [join(directory, 'local.ts')], bundle: true, write: false, metafile: true, format: 'esm', external: ['react'], logLevel: 'silent' });
  assert(!Object.keys(bundle.metafile.inputs).some(file => /(?:node_modules\/idb\/|indexed-db)/u.test(file)), 'local bundle includes IndexedDB');
  const entryImports = Object.keys(pkg.exports).map(entry => `${pkg.name}${entry === '.' ? '' : entry.slice(1)}`);
  await writeFile(join(directory, 'ssr.mjs'), `
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { useForm } from 'react-hook-form';
import { PersistFormProvider } from '${pkg.name}/custom';
const adapter = { async get() { throw Error('SSR read'); }, async set() { throw Error('SSR write'); }, async remove() { throw Error('SSR remove'); } };
for (const specifier of ${JSON.stringify(entryImports)}) {
  const { usePersistForm } = await import(specifier);
  function Form() { const form = useForm({ defaultValues: { name: '' } }); const p = usePersistForm({ form, key: 'ssr' }); return createElement('span', null, p.status); }
  assert.equal(renderToString(createElement(PersistFormProvider, { adapter }, createElement(Form))), '<span>loading</span>');
}
console.log('All public imports and SSR passed without browser globals.');
`);
  execFileSync(process.execPath, ['ssr.mjs'], { cwd: directory, stdio: 'inherit' });
  await writeFile(join(directory, 'dom.mjs'), `
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import 'fake-indexeddb/auto';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test' });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'localStorage', 'sessionStorage']) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createElement } = await import('react');
const { useForm } = await import('react-hook-form');
const { act, renderHook, waitFor, cleanup } = await import('@testing-library/react');
const { PersistFormProvider } = await import('${pkg.name}/custom');
let stored = { version: 1, updatedAt: Date.now(), values: { name: 'restored' } };
const adapter = { async get() { return stored; }, async set(_key, value) { stored = structuredClone(value); }, async remove() { stored = null; } };
const wrapper = ({ children }) => createElement(PersistFormProvider, { adapter }, children);
for (const specifier of ${JSON.stringify(entryImports)}) {
  const { usePersistForm } = await import(specifier);
  const { result } = renderHook(() => { const form = useForm({ defaultValues: { name: '' } }); const persist = usePersistForm({ form, key: specifier }); return { form, persist }; }, { wrapper });
  await waitFor(() => assert.equal(result.current.persist.isRestored, true));
  if (specifier === '${pkg.name}') assert.equal(result.current.form.getValues('name'), 'restored', 'Provider context was split across entrypoints');
  act(() => result.current.form.setValue('name', 'saved'));
  await act(() => result.current.persist.flush());
  assert.equal(result.current.persist.hasDraft, true);
  await act(() => result.current.persist.clearDraft());
  assert.equal(result.current.persist.hasDraft, false);
  cleanup();
}
dom.window.close();
console.log('All entrypoints: restore/save/clear and shared Provider passed.');
`);
  execFileSync(process.execPath, ['dom.mjs'], { cwd: directory, stdio: 'inherit' });
  console.log(`PASS React ${reactVersion}: TypeScript, SSR, live hooks, tree shaking.`);
}
