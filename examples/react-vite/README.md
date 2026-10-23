# Vite example

Из корня библиотеки: `npm ci && npm run prepare:examples`. Затем из этой папки: `npm ci && npm run dev`.

`npm run build` проверяет типы и production bundle. Пример использует настоящий tarball, а не alias на src. При изменении библиотеки повторите `npm run prepare:examples` в корне и `npm ci` здесь: подготовка обновляет checksum только локального архива, остальные зависимости остаются зафиксированными.

Форма демонстрирует localStorage, Controller, useFieldArray, Zod с преобразованием строки в число, исключение пароля и очистку после демо-отправки. Отправка только локальная, сервер отсутствует.
