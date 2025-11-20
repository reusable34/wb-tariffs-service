# Инструкция по отправке на GitHub

## ✅ Всё готово по ТЗ!

Проект полностью соответствует требованиям тестового задания.

## Что нужно сделать перед отправкой:

### 1. Создать новый репозиторий на GitHub

**ВАЖНО:** Создайте НОВЫЙ репозиторий, не мерджите в их шаблон!

1. Перейдите на https://github.com/new
2. Создайте новый репозиторий (например, `wb-tariffs-service`)
3. НЕ инициализируйте его (не добавляйте README, .gitignore и т.д.)

### 2. Инициализировать git в проекте

```bash
cd /Users/komp/Documents/PROGRAMIROVANIE/testWB/btlz-wb-test

# Инициализировать git (если еще не инициализирован)
git init

# Добавить все файлы
git add .

# Сделать первый коммит
git commit -m "Initial commit: WB Tariffs Service"

# Добавить remote (замените YOUR_USERNAME и YOUR_REPO на свои)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Отправить на GitHub
git branch -M main
git push -u origin main
```

### 3. Проверить, что в репозитории есть:

- ✅ `compose.yaml` - Docker Compose конфигурация
- ✅ `Dockerfile` - Dockerfile для приложения
- ✅ `README.md` - Исчерпывающая инструкция
- ✅ `example.env` - Пример конфигурации (БЕЗ чувствительных данных)
- ✅ `package.json` - Зависимости
- ✅ `tsconfig.json` - TypeScript конфигурация
- ✅ `src/` - Весь код приложения
- ✅ `.gitignore` - Игнорирует `.env` и `google-credentials.json`

### 4. Убедиться, что НЕ попали в репозиторий:

- ❌ `.env` - должен быть в .gitignore
- ❌ `google-credentials.json` - должен быть в .gitignore
- ❌ `node_modules/` - должен быть в .gitignore
- ❌ `dist/` - должен быть в .gitignore

### 5. Проверить работу локально

```bash
# Убедитесь, что всё работает
docker compose down
docker compose up --build

# Проверьте логи
docker compose logs -f app
```

### 6. Отправить ссылку на HH

После того как репозиторий создан и код загружен, отправьте ссылку на репозиторий в сообщении на HH.

## Структура проекта (для проверки)

```
btlz-wb-test/
├── compose.yaml              ✅ Docker Compose
├── Dockerfile                ✅ Dockerfile
├── package.json              ✅ Зависимости
├── tsconfig.json             ✅ TypeScript
├── example.env              ✅ Пример конфигурации
├── README.md                 ✅ Исчерпывающая инструкция
├── .gitignore                ✅ Игнорирует чувствительные данные
└── src/
    ├── app.ts                ✅ Точка входа
    ├── config/
    │   ├── env/env.ts        ✅ Конфигурация
    │   └── knex/knexfile.ts  ✅ Knex конфигурация
    ├── postgres/
    │   ├── knex.ts           ✅ Инициализация Knex
    │   ├── migrations/       ✅ Миграции БД
    │   └── seeds/            ✅ Сиды БД
    └── services/
        ├── wb-api.ts         ✅ WB API сервис
        ├── google-sheets.ts  ✅ Google Sheets сервис
        └── scheduler.ts      ✅ Планировщик задач
```

## Соответствие ТЗ

✅ Все требования выполнены:
- Docker и Docker Compose
- PostgreSQL с knex.js
- TypeScript с типами
- Ежечасное получение данных из WB API
- Накопление данных в БД по дням с upsert
- Обновление N Google-таблиц каждые 30 минут
- Лист stocks_coefs создается автоматически
- Данные отсортированы по возрастанию коэффициента
- README с исчерпывающей инструкцией
- example.env без чувствительных данных
- DB credentials: postgres/postgres/postgres
- docker compose up работает одной командой

## Удачи! 🚀
