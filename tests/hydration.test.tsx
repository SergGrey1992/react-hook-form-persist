import { act, waitFor } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { useForm } from 'react-hook-form';
import { expect, it, vi } from 'vitest';
import { usePersistForm } from '../src/local';

it('hydrates the initial markup without mismatch and restores afterwards', async () => {
  localStorage.setItem('hydrate', JSON.stringify({ version: 1, updatedAt: Date.now(), values: { name: 'saved' } }));
  function Form() {
    const form = useForm({ defaultValues: { name: '' } });
    const persist = usePersistForm({ form, key: 'hydrate' });
    return <p>{persist.status}:{form.watch('name')}</p>;
  }
  const element = document.createElement('div');
  element.innerHTML = renderToString(<Form />);
  expect(element.textContent).toBe('loading:');
  document.body.append(element);
  const onRecoverableError = vi.fn();
  const root = hydrateRoot(element, <Form />, { onRecoverableError });
  try {
    await act(async () => { await Promise.resolve(); });
    await waitFor(() => expect(element.textContent).toBe('ready:saved'));
    expect(onRecoverableError).not.toHaveBeenCalled();
  } finally { act(() => root.unmount()); element.remove(); }
});
