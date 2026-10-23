# React Hook Form Persist

Independent ESM TypeScript package for React 18/19 and React Hook Form >=7.55 <8. Automatic draft restoration and debounced persistence, TTL/version checks, nested field exclusion, SSR-safe imports and pluggable asynchronous storage.

The package name is `@serggrey1992/react-hook-form-persist`, under a personal scope matching the GitHub username. Source: [SergGrey1992/react-hook-form-persist](https://github.com/SergGrey1992/react-hook-form-persist). This package has not been published; ownership of the matching npm account must be verified before publishing. Build with `npm ci && npm run check && npm pack`, then install the resulting tarball in your app. Node >=22.18 is required for development; browsers need ES2022 and structuredClone.

```tsx
import { useForm } from 'react-hook-form';
import { usePersistForm } from '@serggrey1992/react-hook-form-persist';

function Form() {
  const form = useForm({ defaultValues: { name: '' } });
  const { status, isRestored, clearDraft, flush } = usePersistForm({
    form, key: 'profile:user-id', debounce: 500,
    maxAge: 30 * 24 * 60 * 60 * 1000, version: 1,
  });
  // Render your form; await clearDraft() after a successful submission.
  // Await flush() before controlled navigation. Handle rejected promises.
  return <input aria-label={status} disabled={!isRestored} {...form.register('name')} />;
}
```

Root import uses the nearest PersistFormProvider or IndexedDB. `/local`, `/session`, `/indexed` always use their named storage, ignoring Provider. `/custom` requires Provider, which is exported from root and `/custom`.

```ts
interface FormDraft<T> { version: number; updatedAt: number; values: T }
interface PersistAdapter {
  get<T>(key: string): Promise<FormDraft<T> | null>;
  set<T>(key: string, draft: FormDraft<T>): Promise<void>;
  remove(key: string): Promise<void>;
}
```

Keep adapter identity stable with a module constant or useMemo. Nesting Providers is supported. `exclude` is a typed FieldPath array and applies to reads/writes. Common password/token property names are excluded by default; `persistSensitiveFields: true` explicitly opts in. This is not comprehensive secret detection. Exclude application-specific sensitive values yourself.

Result: status (`loading|ready|saving|error`), isRestored (attempt completed, including failure), hasDraft, lastSavedAt (`number|null`), flush and clearDraft (`Promise<void>`). Defaults are shown above; enabled defaults true. Disabled hooks perform no I/O and report ready/isRestored false. Use `enabled: !form.formState.isLoading` with async defaultValues.

Initial empty values never overwrite a draft. Edits during slow restoration win over stored values. Pending debounce is discarded on unmount/key/adapter changes; already-started requests cannot be cancelled. clearDraft cancels pending writes and serializes deletion behind active writes. Later edits may create a new draft. It does not reset the form; a subsequent reset can itself trigger persistence.

Web Storage uses JSON (Date becomes string; Map/Set lose contents; BigInt/cycles fail). IndexedDB supports structured-clone values. Uncloneable form fields must be excluded. Core validates the envelope, not your application schema; validate values before submitting. Storage is readable by same-origin scripts and is not XSS protection. Browsers can evict drafts before TTL. Across tabs, last completed write wins; no merge or live synchronization. Browser unload events do not guarantee asynchronous persistence.

See [Russian documentation](README.md), runnable Vite/Next.js examples in the source repository and release instructions in `docs/releasing.md`.
