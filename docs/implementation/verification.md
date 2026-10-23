# Отчёт о проверке — 23 октября 2026

Реализован самостоятельный пакет `@your-scope/react-hook-form-persist@0.1.0` в локальном Git-репозитории. Удалённые репозитории, npm-публикация и GitHub Actions в облаке не запускались.

## Фактически выполнено

| Проверка | Результат |
| --- | --- |
| Чистый `npm ci` корня | Успех после исправления lockfile |
| Vitest на React 19.3.1 + RHF 7.55.0 | 68 тестов, 9 файлов, все прошли |
| Полный набор на React 18.3.1 + RHF 7.90.0 | 66 тестов прошли; дополнительные Controller/hydration тесты добавлены позднее и проверены на React 19 |
| `npm run typecheck` | Успех, включая публичные generic-типы и Zod input/output |
| `npm run lint` | Успех |
| `npm run build` | Успех; ESM, declarations, sourcemaps, пять entrypoint |
| `npm run validate:package` | Все exports существуют, директивы только в JS, разрешённый состав npm-архива |
| `npm run test:consumer` | Настоящий tarball установлен в два независимых временных проекта: React 18 и 19, RHF 7.55.0 |
| TypeScript установленного tarball | Все пять импортов проверены без skipLibCheck; неверный FieldPath отклонён |
| SSR установленного tarball | Все импорты и renderToString без browser globals прошли |
| Runtime установленного tarball | Восстановление/запись/очистка всех entrypoint и общий Provider прошли |
| Tree shaking | esbuild metafile подтверждает отсутствие idb/IndexedDB в local bundle |
| Гидратация | Исходный SSR markup совпадает, восстановление после hydrateRoot, recoverable errors отсутствуют |
| Vite 8.3.5 | `npm ci` и production build с актуальным tarball прошли |
| Next.js 16.4.2 | `npm ci`, TypeScript и production build App Router с prerender прошли |
| Release validator | Блокирует временное имя, несовпадение версии и отсутствие CHANGELOG; валидный fixture проходит |
| `git diff --check` | Без ошибок |

Локальный архив: `your-scope-react-hook-form-persist-0.1.0.tgz`, около 24 КБ. В архиве только dist, package.json, README, README.en, CHANGELOG и LICENSE. Число внутренних declaration chunks может меняться между сборками tsdown; exports проверяются каждый раз.

## Покрытие требований тестами

- Debounce/flush/clear, TTL, версия, отсутствующие и повреждённые данные, ошибки get/set/remove: `tests/hook.test.tsx`, `tests/adapters.test.ts`.
- Гонки: медленное чтение, ввод до восстановления, clear во время чтения/записи, ввод после clear, старая запись при новом монтировании: `tests/hook.test.tsx`, `tests/queue.test.ts`.
- Strict Mode, key/adapter/enabled, async defaultValues, снятие подписок/таймеров: `tests/hook.test.tsx`, `tests/provider.test.tsx`.
- Provider, вложенность, приоритет основного импорта, фиксированные стратегии и IndexedDB fallback: `tests/provider.test.tsx`.
- Вложенные exclude, массивы, чувствительные поля, Map/Set, циклы, неклонируемые исключённые поля, защита прототипов: `tests/values.test.ts`, `tests/hook.test.tsx`.
- useFieldArray: `tests/hook.test.tsx`; Controller и Zod-преобразование: `tests/controller.test.tsx`; типы: `tests/types.tsx`.
- SSR: `tests/ssr.test.tsx` и consumer script; гидратация: `tests/hydration.test.tsx`.

## Найденные и исправленные дефекты

Независимое ревью выявило потерю сохранения после clear во время чтения, пропуск чувствительных свойств в объектах Map/Set и неудаляемый повреждённый JSON. Исправления подтверждены регрессионными тестами.

Дополнительные тесты выявили успешный flush после clone error, клонирование до применения exclude и unhandled rejection при неклонируемом вводе во время восстановления. Все исправлены.

Упаковка выявила несовпадение расширений exports, runtime-директиву в .d.ts и устаревающий integrity локального tarball в примерах. Сборка и validation исправлены; `prepare:examples` обновляет только запись локального пакета перед npm ci. Чистая установка корня выявила неполный lockfile, который был пересоздан и проверен.

## Известные предупреждения и пределы проверки

- React 18 + минимальный RHF 7.55 выдаёт development SSR-предупреждение о useLayoutEffect из RHF. Серверный render завершается успешно; библиотека использует useEffect. Обновлённый RHF 7.x устраняет это предупреждение.
- Vite сообщает о директиве use client при клиентском bundling. Production build проходит; директива нужна Next.js и присутствует в npm entrypoint.
- Проверки IndexedDB выполнялись с fake-indexeddb, DOM — с jsdom. Ручные испытания в нескольких реальных браузерах и нагрузочные проверки внешнего API не выполнялись.
- Реальный npm OIDC/provenance и GitHub workflow требуют настройки владельцем и не проверены публикацией. Перед выпуском нужны реальное имя, metadata и Trusted Publisher.
- TTL не гарантирует сохранность данных; межвкладочного merge/синхронизации нет, последнее завершившееся сохранение побеждает. Ограничения сериализации и секретов описаны в README.
