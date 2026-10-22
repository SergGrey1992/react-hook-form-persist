# React Hook Form Persist — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать и проверить самостоятельную npm-библиотеку сохранения черновиков по согласованной спецификации.

**Architecture:** Общий core управляет восстановлением, подпиской, фильтрацией и последовательными операциями. Независимые адаптеры внедряются через тонкие entrypoint и общий React context.

**Tech Stack:** TypeScript strict, React 18/19, React Hook Form 7, idb, tsdown, Vitest, Testing Library, fake-indexeddb, ESLint, npm.

**Spec:** `docs/superpowers/specs/2026-10-22-persist-form-design.md`.

## Global Constraints

- Имя `@your-scope/react-hook-form-persist`, версия `0.1.0`; scope временный.
- Самостоятельный репозиторий, без внутренних пакетов и зависимостей от Next.js.
- React 18/19 и совместимые RHF 7 как peer dependencies; минимальную RHF 7 с subscribe установить по официальной документации и проверить на нижней границе диапазона.
- Debounce 500 мс, maxAge 30 дней, version 1, enabled true.
- Статусы loading/ready/saving/error; isRestored означает завершённую попытку чтения.
- Все методы адаптера асинхронные; без any и необоснованных type assertions.
- ESM, declarations, sourcemaps, пять entrypoint, общий context, сохранённый use client, local bundle без idb.
- Browser API только при клиентском выполнении; SSR без побочных эффектов.
- Не публиковать npm, не создавать удалённый репозиторий, не отправлять код во внешние сервисы.
- README на русском; автор и реальные URL отсутствуют до предоставления данных.

## Review Focus

1. Редактирование во время медленного чтения: пользовательские значения не теряются — задача 4.
2. Очистка до завершения чтения/записи: старые данные не восстанавливаются после удаления — задача 4.
3. Strict Mode и перекрывающиеся сессии одного ключа: устаревший эффект не меняет новую форму — задачи 3–4.
4. Нестандартные значения и опасные пути: Date/Map/циклы и prototype pollution — задачи 1–2.
5. Разные entrypoint собранного пакета: единый Provider и отсутствие idb в local bundle — задачи 5–6.

## Задача 1: Контракты и независимые адаптеры

**Files:** `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.build.json`, `tsdown.config.ts`, `vitest.config.ts`, `eslint.config.js`, `.gitignore`, `.npmignore`, `src/core/types.ts`, `src/core/validation.ts`, `src/adapters/web-storage.ts`, `src/adapters/indexed-db.ts`, `tests/adapters.test.ts`, `tests/validation.test.ts`.

**Interfaces:** FormDraft<T> и PersistAdapter точно из ТЗ. `createWebStorageAdapter(getStorage: () => Storage): PersistAdapter`; `createIndexedDBAdapter(options?: { databaseName?: string; storeName?: string }): PersistAdapter`; `isDraftEnvelope(value: unknown): value is FormDraft<Record<string, unknown>>`.

- [ ] Сверить официальные API RHF subscribe, idb и tsdown; выбрать совместимые версии, зафиксировать lockfile и engines.
- [ ] Настроить strict TS, lint, тестовый runner и npm scripts typecheck/lint/test/build.
- [ ] Написать тесты get отсутствующего ключа → null, set/get/remove, повреждённого JSON, исключений storage, Date/Map через IndexedDB, повторного использования соединения и отказа открытия БД. Envelope отклоняет null, неверные version/updatedAt и не-объект values.
- [ ] Запустить `npm test -- tests/adapters.test.ts tests/validation.test.ts`; убедиться, что тесты падают из-за отсутствия реализации.
- [ ] Реализовать типы, runtime-проверку и ленивые адаптеры. Недоверенные результаты сначала принимаются как unknown; граница generic адаптера документируется, предметная схема не имитируется.
- [ ] Повторить тесты и `npm run typecheck`; результат — успешные проверки.
- [ ] Зафиксировать готовую часть локальным коммитом.

## Задача 2: Снимки, исключения и восстановление значений

**Files:** `src/core/values.ts`, `tests/values.test.ts`.

**Interfaces:** `snapshotValues<T>(values: T): T`; `filterValues<T>(values: T, exclude: readonly string[], persistSensitiveFields: boolean): T`; `restoreValues<T>(current: T, saved: T, exclude: readonly string[], persistSensitiveFields: boolean): T`. Возвращаемый generic описывает форму данных, а не наличие исключённых свойств; на границе reset использовать корректный partial-тип, если это требуется.

- [ ] Написать тесты неизменности исходных данных, вложенных путей, индексов массивов без сдвига, отсутствующих путей, всех шести чувствительных имён без учёта регистра и opt-in. Проверить сохранение текущих исключённых значений при восстановлении.
- [ ] Добавить Date/Map/циклы и опасные ключи __proto__/constructor/prototype; убедиться, что прототипы не меняются, неподдерживаемый clone завершается ошибкой.
- [ ] Запустить `npm test -- tests/values.test.ts`, зафиксировать ожидаемое падение.
- [ ] Реализовать обход с сохранением структуры и безопасной обработкой путей, отдельно от React и адаптеров.
- [ ] Повторить тесты и typecheck; зафиксировать локальный коммит.

## Задача 3: Очередь операций и жизненный цикл сессии

**Files:** `src/core/queue.ts`, `src/core/session.ts`, `tests/queue.test.ts`, `tests/session.test.ts`.

**Interfaces:** `enqueue<T>(adapter: PersistAdapter, key: string, operation: () => Promise<T>): Promise<T>`. Очередь — WeakMap по адаптеру и Map по ключу; очищает завершённые записи. Сессия предоставляет restore, schedule, flush, clear, dispose; React не участвует в хранении очереди.

- [ ] Написать тесты с управляемыми Promise: порядок set→set→remove, продолжение после отказа, независимость разных ключей, общий порядок для одного адаптера/ключа, освобождение очереди после завершения.
- [ ] Написать тесты debounce 500 мс, отмены ожидающих операций при dispose, сохранения снимка до мутаций исходного объекта, flush с ожидающей и уже начатой записью.
- [ ] Проверить, что clear отменяет ожидающий снимок, ждёт начатую запись, удаляет данные; последующее изменение допускает новую запись. Отказ фоновой операции обработан, отказ flush/clear доступен вызывающему коду.
- [ ] Запустить тесты и увидеть ожидаемое падение; реализовать очередь и сессию с поколениями отмены.
- [ ] Повторить тесты и typecheck; зафиксировать локальный коммит.

## Задача 4: Core hook, Provider и выбор адаптера

**Files:** `src/core/context.tsx`, `src/core/use-persist-form.ts`, `src/core/create-persist-hook.ts`, `src/index.ts`, `src/local.ts`, `src/session.ts`, `src/indexed.ts`, `src/custom/index.ts`, `tests/hook.test.tsx`, `tests/provider.test.tsx`, `tests/lifecycle.test.tsx`.

**Interfaces:** `PersistFormProvider({ adapter, children })`; публичный generic `usePersistForm({ form, key, debounce?, maxAge?, version?, enabled?, exclude?, persistSensitiveFields? })` возвращает status/isRestored/hasDraft/lastSavedAt/clearDraft/flush. Обе команды возвращают Promise<void>. Generic формы сохраняет совместимость с контекстом и преобразованным output resolver.

- [ ] Написать тесты восстановления через reset, отсутствующего черновика, TTL 30 дней, несовместимой версии, повреждённой структуры и ошибок read/write/remove. Проверить isRestored при ошибке и lastSavedAt только после успешной записи.
- [ ] Добавить тесты без записи первоначальных значений, смены key/adapter, enabled false→true, Strict Mode, размонтирования, отсутствия таймеров/подписок, асинхронных defaultValues с управляемым enabled.
- [ ] Добавить гонки: изменение формы во время чтения, clear во время чтения и записи, старое чтение после смены ключа, повторное монтирование при активной записи, flush до завершения восстановления.
- [ ] Добавить таблицу тестов всех импортов с Provider и без, ближайшего вложенного Provider, стабильной ссылки адаптера при rerender и понятной ошибки custom без Provider.
- [ ] Запустить три тестовых файла, подтвердить ожидаемые ошибки отсутствующей реализации.
- [ ] Реализовать единый core на сессии задачи 3, стабильные callbacks и подписку subscribe после восстановления. Специализированные импорты используют фиксированный адаптер.
- [ ] Проверить exclude при чтении/записи, Controller/useFieldArray и сохранение входных значений resolver. Повторить весь набор тестов, typecheck и lint; зафиксировать коммит.

## Задача 5: Сборка, типы и настоящая установка пакета

**Files:** `tests/types.test-d.ts`, `tests/ssr.test.tsx`, `scripts/validate-package.mjs`, `scripts/test-consumer.mjs`, конфигурация сборки и exports из задачи 1.

**Interfaces:** exports `.`, `./local`, `./session`, `./indexed`, `./custom` с types/import; package files allowlist включает dist, README, CHANGELOG и LICENSE.

- [ ] Добавить проверки валидных FieldPath и @ts-expect-error для неизвестных полей, обычного useForm и преобразующего Zod resolver; проверять их отдельным tsc, а не только транспиляцией Vitest.
- [ ] Добавить SSR-тест импорта и renderToString без window/indexedDB; custom проверяется с Provider.
- [ ] Настроить multi-entry ESM build с общим context chunk, внешними React/RHF/idb и сохранённым use client.
- [ ] Выполнить `npm run build`, проверить наличие JS/declarations/maps для каждого export и отсутствие bundled React.
- [ ] Реализовать проверку состава `npm pack --dry-run --json`; запрещать examples/tests/node_modules и временные файлы в архиве.
- [ ] Создать tarball через `npm pack`, установить его в отдельный временный consumer без ссылок на исходники. Выполнить tsc, SSR, bundler smoke и Provider cross-entrypoint smoke; local bundle не должен содержать idb.
- [ ] Повторить проверки для React 18 и 19 и нижней заявленной версии RHF; убрать заявленную совместимость, если она не подтверждается, с явным отражением причины в отчёте.
- [ ] Зафиксировать локальный коммит после успешных проверок.

## Задача 6: Примеры, документация, CI и релизы

**Files:** `examples/react-vite/`, `examples/nextjs/`, `README.md`, `README.en.md`, `CHANGELOG.md`, `LICENSE`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `scripts/check-release.mjs`.

**Interfaces:** примеры потребляют собранный пакет через его публичные imports; CI запускает те же npm scripts, что локальная проверка. Release запускается только workflow_dispatch.

- [ ] Создать минимальные запускаемые примеры Vite и Next.js с defaultValues, Controller, useFieldArray, Zod, статусом сохранения и await clearDraft после успешной отправки. Next.js использует клиентский компонент, README объясняет Pages Router.
- [ ] Подготовить README: установка временного пакета через tarball, quick start, таблица адаптеров, Provider, типизированный custom API, TTL/version, exclude, async defaults, flush, ошибки, безопасность, сериализация и несколько вкладок. Отдельно указать отсутствие публичного npm-релиза.
- [ ] Добавить MIT LICENSE без выдуманного персонального авторства, начальный CHANGELOG и английское описание API.
- [ ] Настроить CI push/PR с npm ci, typecheck, lint, test, build, package validation и матрицей React 18/19.
- [ ] Написать тесты release validation: временное имя, несовпадающая версия и отсутствующая запись CHANGELOG отклоняются. Затем реализовать validator и workflow с OIDC/provenance, защищённым environment и GitHub Release; публикацию не запускать.
- [ ] Документировать выбор реального npm-имени, заполнение metadata, настройку Trusted Publisher, начальную регистрацию пакета при необходимости, bump SemVer/CHANGELOG и ручной запуск релиза.
- [ ] Проверить сборки примеров против tarball, весь набор тестов, typecheck/lint/build и package validation. Зафиксировать результат и ограничения в финальном отчёте; локальный коммит.

## Итоговая приёмка

- [ ] Провести ревью полного diff относительно исходного ТЗ; сопоставить все 25 групп тестов с реальными тестами.
- [ ] Убедиться, что нет any, фиктивных URL/автора, внутренних зависимостей, browser API на уровне модуля и случайного npm-публикационного шага в обычном CI.
- [ ] Отчитаться только по выполненным проверкам; отдельно указать, какие действия остаются владельцу перед публикацией.

## Способ выполнения

Рекомендация: последовательная реализация в текущей задаче. Контракты, очередь и хук сильно связаны; один исполнитель уменьшит расхождения между слоями. Альтернатива — реализация и независимое ревью отдельных задач субагентами, с большим расходом контекста. Способ выбирает пользователь после просмотра плана.
