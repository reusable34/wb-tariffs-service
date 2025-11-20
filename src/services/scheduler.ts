import { saveTariffsToDB } from "./wb-api.js";
import { updateAllGoogleSheets } from "./google-sheets.js";

/**
 * Интервал для получения данных из WB API (в миллисекундах)
 * 1 час = 3600000 мс
 */
const WB_FETCH_INTERVAL = 60 * 60 * 1000; // 1 час

/**
 * Интервал для обновления Google-таблиц (в миллисекундах)
 * 30 минут = 1800000 мс
 */
const GOOGLE_SHEETS_UPDATE_INTERVAL = 30 * 60 * 1000; // 30 минут

let wbFetchIntervalId: NodeJS.Timeout | null = null;
let googleSheetsUpdateIntervalId: NodeJS.Timeout | null = null;

/**
 * Запуск задачи получения данных из WB API
 */
async function runWBFetchTask() {
    try {
        console.log("Запуск задачи получения тарифов из WB API...");
        await saveTariffsToDB();
    } catch (error) {
        console.error("Ошибка при выполнении задачи получения тарифов:", error);
    }
}

/**
 * Запуск задачи обновления Google-таблиц
 */
async function runGoogleSheetsUpdateTask() {
    try {
        console.log("Запуск задачи обновления Google-таблиц...");
        await updateAllGoogleSheets();
    } catch (error) {
        console.error("Ошибка при выполнении задачи обновления Google-таблиц:", error);
    }
}

/**
 * Запуск планировщика задач
 */
export function startScheduler() {
    console.log("Запуск планировщика задач...");

    // Запускаем задачи сразу при старте
    runWBFetchTask().catch(console.error);
    runGoogleSheetsUpdateTask().catch(console.error);

    // Настраиваем регулярное выполнение
    wbFetchIntervalId = setInterval(runWBFetchTask, WB_FETCH_INTERVAL);
    googleSheetsUpdateIntervalId = setInterval(
        runGoogleSheetsUpdateTask,
        GOOGLE_SHEETS_UPDATE_INTERVAL
    );

    console.log(`Планировщик запущен:`);
    console.log(`- Получение тарифов из WB API: каждые ${WB_FETCH_INTERVAL / 1000 / 60} минут`);
    console.log(
        `- Обновление Google-таблиц: каждые ${GOOGLE_SHEETS_UPDATE_INTERVAL / 1000 / 60} минут`
    );
}

/**
 * Остановка планировщика задач
 */
export function stopScheduler() {
    console.log("Остановка планировщика задач...");

    if (wbFetchIntervalId) {
        clearInterval(wbFetchIntervalId);
        wbFetchIntervalId = null;
    }

    if (googleSheetsUpdateIntervalId) {
        clearInterval(googleSheetsUpdateIntervalId);
        googleSheetsUpdateIntervalId = null;
    }

    console.log("Планировщик остановлен");
}


