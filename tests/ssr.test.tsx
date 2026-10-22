// @vitest-environment node
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { useForm } from 'react-hook-form';
import { expect, it } from 'vitest';
import { usePersistForm as root } from '../src';
import { usePersistForm as local } from '../src/local';
import { usePersistForm as session } from '../src/session';
import { usePersistForm as indexed } from '../src/indexed';
it.each([root, local, session, indexed])('renders without browser storage', hook => {
  function Component() { const form = useForm({ defaultValues: { name: '' } }); const persist = hook({ form, key: 'ssr' }); return createElement('span', null, persist.status); }
  expect(renderToString(createElement(Component))).toBe('<span>loading</span>');
});
