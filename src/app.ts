import knex, { migrate, seed } from "#postgres/knex.js";
import { startScheduler, stopScheduler } from "#services/scheduler.js";

// Обработка сигналов для корректного завершения
process.on("SIGTERM", () => {
    console.log("Получен сигнал SIGTERM, завершение работы...");
    stopScheduler();
    knex.destroy().then(() => process.exit(0));
});

process.on("SIGINT", () => {
    console.log("Получен сигнал SIGINT, завершение работы...");
    stopScheduler();
    knex.destroy().then(() => process.exit(0));
});

// Выполнение миграций и сидов
try {
    await migrate.latest();
    await seed.run();
    console.log("Миграции и сиды выполнены успешно");
} catch (error) {
    console.error("Ошибка при выполнении миграций/сидов:", error);
    process.exit(1);
}

// Запуск планировщика задач
startScheduler();

console.log("Приложение запущено и готово к работе");