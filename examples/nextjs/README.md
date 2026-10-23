# Next.js example

Из корня библиотеки: `npm ci && npm run prepare:examples`. Затем из этой папки: `npm ci && npm run dev`.

`npm run build` выполняет production-сборку App Router и проверяет клиентскую границу пакета/SSR. Используется IndexedDB по умолчанию. Форма демонстрирует Controller, useFieldArray, Zod, исключение пароля и локальную демо-отправку; серверного хранения заявок нет.

Для Pages Router поместите тот же DraftForm в components/DraftForm.tsx и экспортируйте страницу из pages/index.tsx:

```tsx
import { DraftForm } from '../components/DraftForm';
export default function Page() { return <DraftForm />; }
```

Удалите конфликтующий app/page.tsx, если заменяете App Router. Отключение SSR не требуется. При использовании React 18 + минимального RHF 7.55 в development SSR сам RHF выдаёт предупреждение о useLayoutEffect; пакет не вызывает useLayoutEffect. Используйте обновлённый RHF 7.x.
