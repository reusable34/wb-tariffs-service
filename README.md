# Сервис для работы с тарифами Wildberries

Сервис выполняет две основные задачи:
1. Регулярное получение информации о тарифах WB и сохранение их в БД на каждый день
2. Регулярное обновление информации о тарифах в Google-таблицах

## Быстрый старт

```bash
# 1. Клонируйте репозиторий
git clone <repository-url>
cd btlz-wb-test

# 2. Скопируйте example.env в .env и заполните WB_API_TOKEN
cp example.env .env
# Отредактируйте .env и добавьте WB_API_TOKEN

# 3. Создайте файл google-credentials.json с JSON ключом Service Account
# (см. инструкцию ниже)

# 4. Запустите приложение
docker compose up
```

Приложение готово к работе! Данные будут автоматически получаться из WB API каждый час и обновляться в Google-таблицах каждые 30 минут.

## Описание

Приложение автоматически:
- Каждый час получает данные о тарифах из WB API (`https://common-api.wildberries.ru/api/v1/tariffs/box`)
- Сохраняет полученные данные в PostgreSQL с группировкой по дням
- Каждые 30 минут обновляет данные в настроенных Google-таблицах
- Данные в Google-таблицах отсортированы по возрастанию коэффициента

## Требования

- Docker и Docker Compose
- Токен WB API (получается на сайте hh.ru)
- Google Service Account credentials для работы с Google Sheets API

## Настройка

### 1. Настройка переменных окружения

Скопируйте файл `example.env` в `.env`:

```bash
cp example.env .env
```

Откройте `.env` и заполните:

```env
POSTGRES_PORT=5432
POSTGRES_DB=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

APP_PORT=5000

WB_API_TOKEN=your_wb_token_here

GOOGLE_SHEETS_SPREADSHEET_IDS=spreadsheet_id_1,spreadsheet_id_2
```

### 2. Получение Google Service Account credentials

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новый проект или выберите существующий
3. Включите Google Sheets API и Google Drive API
4. Создайте Service Account и скачайте JSON ключ
5. Сохраните JSON ключ в файл `google-credentials.json` в корне проекта
6. Поделитесь Google-таблицей с email из поля `client_email` в JSON ключе с правами "Редактор"

### 3. Запуск приложения

```bash
docker compose up
```

## Структура базы данных

### Таблица `wb_tariffs`

Хранит тарифы WB на каждый день с уникальным индексом `(date, box_type)` для обновления данных.

### Таблица `spreadsheets`

Хранит ID Google-таблиц для обновления.

## Проверка функционирования

### Проверка логов

```bash
docker compose logs -f app
```

### Проверка данных в БД

```bash
docker compose exec postgres psql -U postgres -d postgres
```

```sql
SELECT * FROM wb_tariffs WHERE date = CURRENT_DATE ORDER BY coefficient ASC;
```

### Проверка Google-таблиц

Откройте настроенные Google-таблицы, перейдите на лист `stocks_coefs` и убедитесь, что данные обновляются каждые 30 минут и отсортированы по возрастанию коэффициента.

## Структура проекта

```
btlz-wb-test/
├── compose.yaml              # Docker Compose конфигурация
├── Dockerfile                # Dockerfile для приложения
├── package.json              # Зависимости проекта
├── example.env               # Пример файла с переменными окружения
├── README.md                 # Этот файл
└── src/
    ├── app.ts                # Точка входа приложения
    ├── config/
    │   ├── env/env.ts        # Конфигурация переменных окружения
    │   └── knex/knexfile.ts  # Конфигурация Knex
    ├── postgres/
    │   ├── knex.ts           # Инициализация Knex
    │   ├── migrations/       # Миграции БД
    │   └── seeds/            # Сиды БД
    └── services/
        ├── wb-api.ts         # Сервис для работы с WB API
        ├── google-sheets.ts  # Сервис для работы с Google Sheets
        └── scheduler.ts       # Планировщик задач
```

## Лицензия

ISC
