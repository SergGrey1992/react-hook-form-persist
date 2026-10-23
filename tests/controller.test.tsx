import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { expect, it, vi } from 'vitest';
import { PersistFormProvider, usePersistForm } from '../src/custom';
import { memoryAdapter } from './helpers';

it('persists Controller input while submit receives transformed resolver output', async () => {
  const { adapter, data } = memoryAdapter();
  const submitted = vi.fn();
  const schema = z.object({ count: z.string().transform(Number) });
  function Form() {
    const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
      defaultValues: { count: '1' }, resolver: zodResolver(schema),
    });
    const persist = usePersistForm({ form, key: 'controller' });
    return <form onSubmit={form.handleSubmit(values => submitted(values))}>
      <Controller control={form.control} name="count" render={({ field }) => <input aria-label="Количество" {...field} />} />
      <button type="button" disabled={!persist.isRestored} onClick={() => { void persist.flush(); }}>Сохранить</button>
      <button type="submit">Отправить</button>
    </form>;
  }
  render(<PersistFormProvider adapter={adapter}><Form /></PersistFormProvider>);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить' })).toHaveProperty('disabled', false));
  fireEvent.change(screen.getByLabelText('Количество'), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(data.get('controller')).toMatchObject({ values: { count: '3' } }));
  fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
  await waitFor(() => expect(submitted).toHaveBeenCalledWith({ count: 3 }));
});
