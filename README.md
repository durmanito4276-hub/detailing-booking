# Detailing Booking — приложение записи в детейлинг-студию

## Как собрать проект на компьютере (инструкция для новичка)

### Шаг 1. Создайте структуру папок

Скачайте все файлы по ссылкам из чата и разложите так (расширения файлов меняйте через Блокнот → «Сохранить как…» → имя в кавычках, тип «Все файлы»):

```
detailing-booking/
├── package.json
├── vercel.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── .gitignore
├── tenants/
│   └── demo-studio/
│       └── tenant.json
└── src/
    ├── main.tsx          (скачан как main.txt)
    ├── App.tsx           (App.txt)
    ├── supabase.ts       (supabase.txt)
    ├── types.ts          (types.txt)
    ├── api.ts            (api.txt)
    ├── booking.ts        (booking.txt)
    ├── styles.css        (styles.txt)
    └── pages/
        ├── Home.tsx        (Home.txt)
        ├── Book.tsx        (Book.txt)
        ├── BookingView.tsx (BookingView.txt)
        ├── Admin.tsx       (два файла-части: часть 1 + добавление)
        ├── Settings.tsx    (два файла-части: часть 1 + добавление)
        └── NotFound.tsx    (NotFound.txt)
```

### Шаг 2. Установите зависимости и соберите

Откройте папку detailing-booking, в адресной строке проводника напишите `cmd` и нажмите Enter (откроется чёрное окно). Вставляйте команды по одной (Ctrl+V или правый клик):

```
corepack enable
pnpm install
pnpm build
```

Если `pnpm build` прошёл без ошибок — проект собрался.

### Шаг 3. Загрузите в GitHub

В том же чёрном окне (замените ВАШ_ЛОГИН на ваш логин GitHub):

```
git init
git add .
git commit -m "Первый запуск"
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/detailing-booking.git
git push -u origin main
```

### Шаг 4. Опубликуйте в Vercel

1. vercel.com → Add New → Project
2. Выберите репозиторий detailing-booking → Import
3. В разделе Environment Variables добавьте две переменные:
   - `VITE_SUPABASE_URL` = https://pohunbfcevgzqavpjqwx.supabase.co
   - `VITE_SUPABASE_KEY` = sb_publishable_pF5CIXI5yfVNU0gUoW1b9Q_32F_3HcQ
4. Deploy → через пару минут получите рабочую ссылку

### Шаг 5. Проверьте

- Главная: `https://ваш-адрес.vercel.app/`
- Запись клиента: `/demo-studio/book`
- Кабинет владельца: `/demo-studio/admin` (почта и пароль, которые вы создали в Supabase → Authentication)
- Настройки студии: `/demo-studio/admin/settings`

## Как добавить новую студию (5 минут, без кода)

1. Supabase → SQL Editor → вставьте (замените название на латинице, телефон, адрес):
```
insert into tenants (slug, name, settings) values ('novaya-studiya', 'Новая студия',
 '{"phone": "+7 900 111-22-33", "address": "г. Москва, ул. Новая, 5", "about": "Описание"}');
```
2. Добавьте услуги, боксы, карточки и фото теми же запросами (шаблон — в чате).
3. Создайте владельца: Authentication → Users → Add user, затем SQL-запрос привязки.
4. Ссылка для клиентов: `https://ваш-адрес.vercel.app/novaya-studiya/book`

## Что уже работает

- Запись клиента: услуга → день → бокс → свободное время → имя/телефон/авто
- Занятое время показывается серым «(занято)», дважды забронировать нельзя (защита в базе)
- Отмена клиентом по секретной ссылке
- Кабинет владельца: вход, записи день/неделя, цифры, статусы, оплата/возврат, ручная запись
- Настройки студии: название, телефон, адрес, услуги/цены, боксы, карточки, фото работ

## Чего пока нет (честно)

- PWA (установка на главный экран телефона) — добавим следующим шагом через vite-plugin-pwa
- ИИ-помощник — без OpenAI-ключа; сейчас на готовых сценариях
- Тесты Vitest/Playwright — каркас добавим после запуска
