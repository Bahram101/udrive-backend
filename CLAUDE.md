# uDrive Backend

API сервиса такси uDrive для небольшого города (Чунджа, Казахстан). Клиенты: мобильное приложение (`uDrive-mobile`) и админка (`uDrive-web`, через BFF).

**Всегда работай с agy** (см. раздел «Работа с agy»).

## Рабочее пространство uDrive

`D:\projects\uDrive\` содержит три отдельных репозитория: `uDrive-backend` (этот), `uDrive-web` (сайт + админка, см. его `CLAUDE.md`), `uDrive-mobile` (Expo-приложение клиентов и водителей).

## Стек

- Next.js 16 (App Router, только API Routes), TypeScript (strict)
- Prisma 7 (`@prisma/adapter-pg`, клиент генерируется в `src/generated/prisma`, не в git), PostgreSQL 17 (Docker, порт 5434)
- JWT (`jsonwebtoken`): access 15 мин, refresh 30 дней
- Expo push-уведомления, Telegram-бот для OTP
- Socket.IO упоминался в планах, но пока **не используется**

## Структура

- `src/app/api/<area>/.../route.ts` — тонкие роуты: Zod-парсинг → сервис → `Response.json`, ошибки через `handleApiError`.
- `src/services/*.service.ts` — бизнес-логика (`AuthService`, `OrdersService`, `DriverService`, `ClientService`, `TelegramService`).
- `src/schemas/*.schema.ts` — Zod-схемы входящих данных.
- `src/lib/` — `prisma.ts` (singleton), `auth.ts` (`withAuth`), `jwt.ts`, `otp.ts`, `errors.ts` (`AppError`, `handleApiError`), `geo.ts`, `pushNotifications.ts`, `constants.ts`.

## Модель данных

- `User` (phone, name, role: CLIENT | DRIVER | ADMIN, rating, pushToken) → `Driver` (carModel, carNumber, isOnline, rating, lat, lng, pushToken).
- `Order`: from/to адрес и координаты, `price` (пока всегда 400 ₸), `status`: NEW → ACCEPTED → ARRIVED → STARTED → COMPLETED | CANCELLED; `completedAt`, `cancelledAt`, `cancelledBy` (CLIENT | DRIVER). У старых заказов эти поля `null`.
- `TelegramLink` (phone → chatId), `OtpCode` (code, attempts, expiresAt).

## Ключевые сценарии

- **OTP**: `send-otp` → код в Telegram (лимит: 1 в минуту, 5 в час на номер). `verify-otp`: максимум 5 попыток на код (попытка списывается атомарно до сравнения), код одноразовый. Новый пользователь без name/role → 422 (код остаётся валидным). Коды старше 1 часа удаляются.
- **Telegram webhook**: проверяется заголовок `X-Telegram-Bot-Api-Secret-Token` (= `TELEGRAM_WEBHOOK_SECRET`) и что контакт принадлежит отправителю. Регистрация: `npm run telegram:webhook` (ngrok).
- **Refresh**: роль и существование пользователя берутся из БД, не из токена.
- **Заказ**: у клиента максимум один активный заказ (блокировка строки User). Заказ создаётся NEW, затем `tryAssignOrderToDriver` пробует 3 ближайших свободных онлайн-водителя (блокировка строки Driver). Водитель, выходящий на линию, получает ближайший NEW-заказ той же функцией.

## Принципы кода (обязательно)

- **Без дублирования (DRY).** Повторяющаяся логика — в одну общую функцию (пример: `tryAssignOrderToDriver`). Перед написанием кода ищи, что уже есть.
- **Конкурентность**: смена статуса — через `updateMany` с условием на текущий статус и проверкой `count`; конкурирующие операции — в транзакции с `SELECT ... FOR UPDATE`. Никаких «прочитал → проверил → записал» без защиты.
- **Безопасность**: секреты только в env; сравнение секретов — `timingSafeEqual`; случайные коды — `crypto.randomInt`; роль проверяется на сервере (для админских эндпоинтов — по БД); лимиты на всё, что можно перебирать; не логировать телефоны, коды, токены.
- **Валидация**: все входящие данные — через Zod в роуте.
- **Ошибки**: `AppError(status, message)`; сообщения для пользователя — на русском.
- **TypeScript без `any`**, минимальный дифф, стиль как в соседнем коде, комментарии только для неочевидного «почему», без `console.log`.
- **API Routes only**, без Server Actions, Prisma singleton.
- **Миграции**: каждое изменение `schema.prisma` — с файлом миграции в `prisma/migrations`. Затем `npx prisma generate`. Применение: `npx prisma migrate deploy` (локально и на сервере после деплоя кода).
- **Часовой пояс** для дневной статистики: `Asia/Almaty` (UTC+5).
- Изменения API не должны ломать мобильное приложение (оно, например, определяет нового пользователя по статусу 422).

## Проверка перед сдачей

```bash
npx tsc --noEmit   # ошибки из .next/types — старый кэш, игнорировать
npm run lint
```

Если что-то не проверено (например, на реальной БД) — прямо об этом сказать.

## Git

- Conventional Commits на английском: `fix(auth): ...`, `feat(orders): ...`.
- Коммит/пуш — только по просьбе владельца. Не коммитить `.env`, `.env.local`.

## Общение

- **Все `.md` файлы — только на русском.**

## Работа с agy

- Задачи выполняют агенты agy (скилл `agy`), Claude — оркестратор: бриф, проверка, отчёт.
- Перед запуском: `agy-ts status` и `agy models`. `gemini-3.1-pro-high` недоступна на аккаунте; для `claude-opus-4-6-thinking` передавать `--effort ""`.
- Если квота agy закончилась — сообщить время восстановления и спросить владельца.

## Текущее состояние и задачи

- Сделано (2026-10-14): защита Telegram webhook, лимит попыток OTP, `crypto.randomInt`, роль из БД при refresh, один активный заказ на клиента, `completedAt/cancelledAt/cancelledBy`, очистка OTP.
- **При деплое на сервер**: добавить `TELEGRAM_WEBHOOK_SECRET` в env, перерегистрировать webhook, выполнить `npx prisma migrate deploy`.
- **Не сделано — «зависший» онлайн водителя**: координаты шлются только при движении ≥20 м (`distanceInterval: 20` в мобильном приложении), поэтому нельзя понять, что приложение закрыто. Нужно: heartbeat из мобильного приложения каждые 30–60 с + поле `lastSeenAt` у `Driver`, офлайн после ~2 мин без сигнала.
- **Следующее**: админские эндпоинты `/api/admin/*` для дашборда (статистика, заказы, водители, неделя, карта, поиск) с проверкой роли ADMIN по БД. Модели «Выплаты» пока нет.
