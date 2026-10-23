import { defineConfig } from 'tsdown';
export default defineConfig({
  entry: ['src/index.ts', 'src/local.ts', 'src/session.ts', 'src/indexed.ts', 'src/custom/index.ts'],
  format: 'esm', platform: 'neutral', target: 'es2022', fixedExtension: false, dts: true, sourcemap: true, clean: true,
  tsconfig: 'tsconfig.build.json',
  deps: { neverBundle: ['react', 'react/jsx-runtime', 'react-hook-form', 'idb'] },
  // Every emitted JS chunk receives the client directive via banner.
  suppressWarnings: [/module level directive/],
  banner: { js: '"use client";' },
});
