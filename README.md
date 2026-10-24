# React Hook Form Persist

Самостоятельная TypeScript-библиотека автоматического сохранения черновиков React Hook Form. Один хук, асинхронные адаптеры, debounce, TTL, версии и исключение полей. React 18/19, React Hook Form 7.55–7.x, SSR. ESM; CommonJS не поставляется.

**Статус:** версия 0.1.0, исходники доступны в [личном GitHub-репозитории](https://github.com/SergGrey1992/react-hook-form-persist). Имя пакета — `@serggrey1992/react-hook-form-persist`; пакет ещё не опубликован.

## Установка

До публикации используйте локальный архив:

```sh
npm ci
npm run check
npm pack
# В другом React-проекте:
npm install /absolute/path/serggrey1992-react-hook-form-persist-0.1.0.tgz
# Аналогично: pnpm add /absolute/path/package.tgz или yarn add /absolute/path/package.tgz
```

После публикации: `npm install @serggrey1992/react-hook-form-persist react-hook-form`. React и React Hook Form — peer dependencies. Для разработки/сборки требуется Node.js 22.18+; клиентский код использует ES2022 и `structuredClone` (современные браузеры).

## Быстрый старт

```tsx
import { useForm } from 'react-hook-form';
import { usePersistForm } from '@serggrey1992/react-hook-form-persist';

type Application = { name: string; email: string };

export function ApplicationForm() {
  const form = useForm<Application>({ defaultValues: { name: '', email: '' } });
  const persist = usePersistForm({ form, key: 'application:user-42' });

  return (
    <form onSubmit={form.handleSubmit(async values => {
      const response = await fetch('/api/application', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error('Не удалось отправить форму');
      await persist.clearDraft();
    })}>
      <fieldset disabled={!persist.isRestored}>
        <input aria-label="Имя" {...form.register('name')} />
        <input aria-label="Email" {...form.register('email')} />
        <button type="submit">Отправить</button>
      </fieldset>
      <p role="status">Черновик: {persist.status}</p>
    </form>
  );
}
```

Обрабатывайте ошибки отправки и `clearDraft()` в UI вашего приложения. Ключ должен различать формы и пользователей; после смены пользователя меняйте ключ и удаляйте персональные черновики при выходе.

## Выбор хранилища

| Импорт | Без Provider | С Provider | Формат |
| --- | --- | --- | --- |
| основной | IndexedDB | адаптер Provider | зависит от адаптера |
| `/local` | localStorage | localStorage | JSON |
| `/session` | sessionStorage | sessionStorage | JSON |
| `/indexed` | IndexedDB | IndexedDB | structured clone |
| `/custom` | понятная ошибка | ближайший Provider | произвольный |

```tsx
import { usePersistForm } from '@serggrey1992/react-hook-form-persist/local';
// или /session, /indexed
```

Специальные импорты используют фиксированное хранилище. `/local` и `/session` не включают IndexedDB/idb в граф зависимостей. Адаптер IndexedDB использует базу `react-hook-form-persist`, object store `drafts`. Web Storage использует переданный ключ без префикса: выбирайте свой namespace.

## API

```tsx
const { status, isRestored, hasDraft, lastSavedAt, clearDraft, flush } = usePersistForm({
  form,
  key: 'unique-form-key',
  debounce: 500,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  version: 1,
  enabled: true,
  exclude: ['password', 'profile.internalNote'], // FieldPath<T>[]
  persistSensitiveFields: false,
});
```

| Поле | Значение |
| --- | --- |
| `status` | `loading`, `ready`, `saving` или `error` |
| `isRestored` | попытка чтения завершилась, включая ошибку; остаётся true при сохранении |
| `hasDraft` | наличие подтверждённого черновика, известное этой сессии |
| `lastSavedAt` | timestamp прочитанного валидного черновика или последней подтверждённой записи; иначе null |
| `flush(): Promise<void>` | ждёт восстановления, записывает ожидающие изменения без debounce, ждёт уже поставленную запись |
| `clearDraft(): Promise<void>` | отменяет ожидающие снимки, ждёт начатые операции, удаляет черновик |

Необязательные значения показаны с defaults. `debounce` — конечное число от 0 до 2³¹−1 мс, `maxAge` — конечное неотрицательное число, `version` — неотрицательное целое безопасного диапазона. Пустой ключ и неверные параметры вызывают ошибку.

`enabled: false` не читает, не пишет и не удаляет данные; команды становятся no-op, status ready, isRestored false. Смена key/adapter/enabled создаёт новую сессию. Изменение настроек восстановления также перезапускает сессию, поэтому задавайте их стабильно.

Фоновые ошибки перехватываются и отражаются в `status: 'error'`; `flush` и `clearDraft` отклоняют Promise при ошибке своей операции. Повторный `flush` повторяет неудавшуюся запись, если её не заменили новые изменения. Ошибка чтения не блокирует дальнейшее сохранение. Подробные ошибки custom storage можно логировать внутри адаптера, не записывая персональные значения в логи.

## Provider и свой адаптер

```tsx
import { PersistFormProvider } from '@serggrey1992/react-hook-form-persist/custom';
import type { FormDraft, PersistAdapter } from '@serggrey1992/react-hook-form-persist/custom';

export const apiAdapter: PersistAdapter = {
  async get<T>(key: string): Promise<FormDraft<T> | null> {
    const response = await fetch(`/api/drafts/${encodeURIComponent(key)}`, { credentials: 'same-origin' });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Read draft: ${response.status}`);
    const value: unknown = await response.json();
    if (!isEnvelope(value)) throw new Error('Invalid draft envelope');
    // T нельзя проверить во время выполнения. Предметную схему проверяет приложение.
    return value as FormDraft<T>;
  },
  async set<T>(key: string, draft: FormDraft<T>): Promise<void> {
    const response = await fetch(`/api/drafts/${encodeURIComponent(key)}`, {
      method: 'PUT', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
    });
    if (!response.ok) throw new Error(`Write draft: ${response.status}`);
  },
  async remove(key: string): Promise<void> {
    const response = await fetch(`/api/drafts/${encodeURIComponent(key)}`, { method: 'DELETE', credentials: 'same-origin' });
    if (!response.ok && response.status !== 404) throw new Error(`Delete draft: ${response.status}`);
  },
};

function isEnvelope(value: unknown): value is FormDraft<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null) return false;
  return 'version' in value && typeof value.version === 'number' && Number.isFinite(value.version)
    && 'updatedAt' in value && typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt)
    && 'values' in value && typeof value.values === 'object' && value.values !== null && !Array.isArray(value.values);
}

export function Root({ children }: { children: React.ReactNode }) {
  return <PersistFormProvider adapter={apiAdapter}>{children}</PersistFormProvider>;
}
```

Provider поддерживает вложенность; основной хук и `/custom` используют ближайший. Храните adapter на уровне модуля или создавайте через `useMemo`; inline-объект на каждом рендере означает новый адаптер и повторное чтение. Адаптер выполняет только get/set/remove, возвращая Promise. Debounce, TTL, версии и исключения принадлежат core.

Сервер **обязан** проверять авторизацию и принадлежность ключа текущему пользователю, валидировать данные, ограничивать размер и реализовать нужную CSRF-защиту. Клиентский ключ не является разрешением доступа. Для конкурентного серверного редактирования используйте ревизии/ETag на стороне API; базовый контракт автоматического merge не предлагает.

## Восстановление, гонки и очистка

До завершения чтения начальные значения не сохраняются. Валидный черновик восстанавливается через `reset`, затем подключается `subscribe`. Если пользователь успел изменить значения во время чтения, восстановление пропускается и сохраняются пользовательские изменения. Можно отключить поля на время загрузки, как в quick start.

Для каждой пары «ссылка адаптера + ключ» операции последовательны в пределах одного экземпляра библиотеки. Устаревшие результаты не меняют новую сессию. React Strict Mode поддерживается. Очистка во время чтения запрещает поздний reset; очистка во время записи ставит remove после неё. Изменения, внесённые **после** вызова clearDraft, могут создать новый черновик; форма сама не сбрасывается.

При размонтировании/смене ключа ожидающий debounce и ещё не начатые записи отменяются. Уже отправленную операцию произвольного адаптера отменить невозможно. Перед управляемой навигацией вызывайте `await flush()`. `pagehide`, `visibilitychange`, закрытие вкладки и отключение питания не гарантируют завершение асинхронной записи; библиотека не обещает такую гарантию.

После успешной отправки используйте `await clearDraft()`. Если затем вызываете `form.reset()`, подписка воспринимает reset как изменение — он может создать новый черновик. Для перехода к пустой форме сначала отключите сохранение/размонтируйте её или очистите черновик после reset.

## TTL и версии

Черновик хранится как `{ version, updatedAt, values }`. При чтении истёкший TTL, другая версия или повреждённый envelope приводят к удалению без восстановления. JSON, который невозможно разобрать, также удаляется; ошибка доступа к хранилищу приводит к status error без попытки удаления. TTL проверяется при чтении и не является фоновым таймером удаления. Для несовместимой схемы увеличьте `version`; автоматических миграций нет.

Core проверяет базовую структуру, но не предметную схему TypeScript. Используйте resolver/схему для валидации перед отправкой. Не рендерите HTML из черновиков без соответствующей защиты.

## Исключение полей и безопасность

`exclude` поддерживает вложенные пути и индексы массивов (`contacts.0.privateNote`). Индексы не сдвигаются; пропуски JSON-массивов могут превратиться в null. Исключения действуют и при чтении, и при записи; текущие значения исключённых полей не заменяются данными из черновика.

По умолчанию рекурсивно исключаются свойства объектов (включая объекты внутри Map/Set) `password`, `confirmPassword`, `token`, `accessToken`, `refreshToken`, `secret` без учёта регистра. `persistSensitiveFields: true` — явное разрешение сохранять эти имена; пользовательский exclude всё равно действует. Это ограниченный список, а не распознавание секретов: поля с другими именами, строковые ключи Map и строки с токенами нужно исключать самостоятельно.

Все browser storage доступны скриптам того же origin и **не защищают от XSS**. Черновики могут содержать персональные данные; настройте срок и удаление при выходе. Локальное хранение не является шифрованием или резервным копированием.

## Ограничения сериализации и вкладки

- Web Storage: JSON; Date становится строкой, undefined удаляется, Map/Set теряют содержимое, BigInt и циклы вызывают ошибку. Квоты и доступность зависят от браузера.
- IndexedDB: structured clone, включая Date/Map/Set и циклы. Функции, некоторые объекты платформы и FileList могут быть неклонируемыми; исключайте такие поля. Core исключает поля и затем снимает независимый structuredClone перед записью для всех адаптеров.
- Браузер может удалить IndexedDB раньше TTL, особенно в приватном режиме или при нехватке места. Автоматического перехода на другой тип хранения нет: ошибки видны приложению.
- Несколько вкладок: последняя завершённая запись побеждает. Нет межвкладочной блокировки, автоматического слияния и live-синхронизации. Разные экземпляры custom adapter также имеют разные очереди. Для редактирования с конфликтами нужен серверный протокол.

## Асинхронные defaults, Zod и компоненты RHF

```tsx
const form = useForm<Values>({ defaultValues: async () => loadDefaults() });
const persist = usePersistForm({ form, key: 'async-form', enabled: !form.formState.isLoading });
```

Пока defaults загружаются, не включайте восстановление. `Controller`, вложенные поля и `useFieldArray` работают через подписку всей формы.

```tsx
const schema = z.object({ count: z.string().transform(Number) });
const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
  resolver: zodResolver(schema), defaultValues: { count: '' },
});
usePersistForm({ form, key: 'zod-example' });
```

Сохраняются входные значения (`count: string`), а не преобразованный результат resolver. Zod и resolvers — зависимости приложения, не библиотеки.

## Vite и Next.js

Запускаемые проекты: [examples/react-vite](examples/react-vite) и [examples/nextjs](examples/nextjs). Выполните `npm run prepare:examples` в корне, затем `npm ci` в папке примера. Подготовка создаёт tarball и обновляет его checksum в lockfiles, сохраняя версии остальных зависимостей.

Next.js App Router: форма находится в файле с `'use client'`; entrypoint библиотеки сохраняет эту директиву при сборке. Provider с функциями-адаптерами также размещается в клиентском компоненте. Серверный импорт не открывает БД, SSR не читает window; начальное состояние совпадает с первой клиентской отрисовкой.

React 18 с минимальным RHF 7.55 может выдавать development SSR-предупреждение о useLayoutEffect из самого RHF; серверный render при этом завершается. Для устранения предупреждения обновите RHF 7.x.

Next.js Pages Router: импортируйте тот же компонент формы в `pages/index.tsx`; `dynamic(..., { ssr: false })` не требуется.

## Разработка и выпуск

```sh
npm ci
npm run check
npm run test:consumer
```

`test:consumer` создаёт временные независимые проекты, устанавливает настоящий tarball и проверяет React 18/19, JS/types imports, SSR, общий Provider, сохранение и local bundle без idb. Нужен доступ к npm registry. Папки печатаются для диагностики.

CI проверяет push/PR. [Инструкция релиза](docs/releasing.md) описывает SemVer, metadata и ручной workflow. Публикация выполняется только через release workflow после его настройки и явного запуска владельцем.

## FAQ

**Почему не сохраняются первые пустые значения?** Они намеренно не считаются изменением: это защищает существующий черновик во время чтения.

**Почему при Provider всё ещё используется localStorage?** `/local` имеет фиксированную стратегию. Для Provider используйте основной импорт или `/custom`.

**Можно ли менять ключ?** Да; ожидающие изменения старого ключа отменяются. Сначала await flush(), если их нужно сохранить.

**Почему status error, а isRestored true?** Чтение уже завершилось с ошибкой. Форма доступна для редактирования; новые изменения могут сохраниться успешно.

**Обновляется ли черновик при отправке?** Библиотека не перехватывает submit. Вы решаете, когда вызвать clearDraft после подтверждения сервера.

**Есть ли гарантия отсутствия потерь?** Нет. Debounce, закрытие страницы, квоты, отказ сервера и очистка браузером могут приводить к потере несохранённых данных. Для важных операций ждите flush и обрабатывайте отказ.

## Источники API

- [RHF subscribe](https://react-hook-form.com/docs/useform/subscribe)
- [idb](https://github.com/jakearchibald/idb)
- [tsdown](https://tsdown.dev/)
- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)
