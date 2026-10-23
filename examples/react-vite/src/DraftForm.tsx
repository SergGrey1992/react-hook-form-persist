import { useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usePersistForm } from '@your-scope/react-hook-form-persist/local';

const schema = z.object({
  name: z.string().min(1, 'Введите имя'),
  quantity: z.string().regex(/^\d+$/, 'Введите целое число').transform(Number),
  note: z.string(),
  password: z.string(),
  contacts: z.array(z.object({ email: z.string().email('Некорректный email') })),
});
export function DraftForm() {
  const [message, setMessage] = useState('');
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', quantity: '1', note: '', password: '', contacts: [] },
  });
  const contacts = useFieldArray({ control: form.control, name: 'contacts' });
  const persist = usePersistForm({ form, key: 'example:application', exclude: ['password'] });
  const labels = { loading: 'Загрузка черновика', ready: 'Готово', saving: 'Сохранение', error: 'Не удалось сохранить черновик' };
  return <main style={{ maxWidth: 560, margin: '3rem auto', fontFamily: 'system-ui', lineHeight: 1.7 }}>
    <h1>Черновик заявки</h1>
    <p>Заполните форму и обновите страницу. Пароль не сохраняется.</p>
    <form onSubmit={form.handleSubmit(async values => {
      try {
        // Demo acceptance only. In production, await a successful server response here.
        await persist.clearDraft();
        setMessage(`Демо: заявка «${values.name}», количество ${values.quantity}, принята локально. Черновик удалён.`);
      } catch { setMessage('Не удалось удалить черновик. Попробуйте ещё раз.'); }
    })}>
      <fieldset disabled={!persist.isRestored || form.formState.isSubmitting}>
        <legend>Данные заявки</legend>
        <label>Имя <input {...form.register('name')} /></label><br />
        <p role="alert">{form.formState.errors.name?.message}</p>
        <label>Количество <input inputMode="numeric" {...form.register('quantity')} /></label><br />
        <p role="alert">{form.formState.errors.quantity?.message}</p>
        <Controller name="note" control={form.control} render={({ field }) => <label>Примечание <textarea {...field} /></label>} /><br />
        <label>Пароль <input type="password" autoComplete="new-password" {...form.register('password')} /></label>
        {contacts.fields.map((field, index) => <div key={field.id}>
          <label>Email {index + 1} <input {...form.register(`contacts.${index}.email`)} /></label>
          <button type="button" onClick={() => contacts.remove(index)}>Удалить контакт</button>
          <p role="alert">{form.formState.errors.contacts?.[index]?.email?.message}</p>
        </div>)}
        <p><button type="button" onClick={() => contacts.append({ email: '' })}>Добавить контакт</button></p>
        <button type="submit">Отправить (демо)</button>{' '}
        <button type="button" onClick={() => { void persist.flush().then(() => setMessage('Черновик сохранён'), () => setMessage('Ошибка сохранения')); }}>Сохранить сейчас</button>
      </fieldset>
    </form>
    <p role="status">{labels[persist.status]}{persist.hasDraft ? ' · Есть черновик' : ''}</p>
    <p aria-live="polite">{message}</p>
  </main>;
}
