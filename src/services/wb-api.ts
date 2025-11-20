import env from "#config/env/env.js";
import knex from "#postgres/knex.js";

/**
 * Интерфейс для данных тарифа из WB API
 */
interface WBTariffItem {
    box_type: string;
    coefficient: number;
    [key: string]: unknown;
}

/**
 * Получение данных о тарифах из WB API
 * @returns {Promise<WBTariffItem[]>} Массив тарифов
 */
export async function fetchWBTariffs(date?: string): Promise<WBTariffItem[]> {
    // Используем переданную дату или текущую дату
    const targetDate = date || new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    
    // API требует параметр date в query string
    const apiUrl = `https://common-api.wildberries.ru/api/v1/tariffs/box?date=${targetDate}`;
    
    if (!env.WB_API_TOKEN) {
        throw new Error("WB_API_TOKEN не установлен в переменных окружения");
    }

    // Пробуем разные форматы авторизации
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    // Сначала пробуем с Bearer
    headers["Authorization"] = `Bearer ${env.WB_API_TOKEN}`;

    let response = await fetch(apiUrl, { headers });

    // Если 401 или 403, пробуем без Bearer
    if (response.status === 401 || response.status === 403) {
        headers["Authorization"] = env.WB_API_TOKEN;
        response = await fetch(apiUrl, { headers });
    }

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error(`Ошибка API WB: ${response.status} ${response.statusText}`, errorText);
        throw new Error(
            `Ошибка при получении данных из WB API: ${response.status} ${response.statusText}. Ответ: ${errorText.substring(0, 200)}`
        );
    }

    const data = await response.json();
    
    // API возвращает структуру: { response: { data: { warehouseList: [...] } } }
    // Извлекаем список складов и преобразуем в массив тарифов
    const tariffs: WBTariffItem[] = [];
    
    if (data.response?.data?.warehouseList && Array.isArray(data.response.data.warehouseList)) {
        const warehouseList = data.response.data.warehouseList;
        
        for (const warehouse of warehouseList) {
            // Извлекаем различные типы коэффициентов из каждого склада
            const warehouseName = warehouse.warehouseName || "unknown";
            const geoName = warehouse.geoName || "";
            
            // Коэффициенты хранения (boxStorageCoefExpr)
            if (warehouse.boxStorageCoefExpr && warehouse.boxStorageCoefExpr !== "-") {
                tariffs.push({
                    box_type: `${geoName ? geoName + " - " : ""}${warehouseName} (хранение)`,
                    coefficient: parseFloat(String(warehouse.boxStorageCoefExpr)) / 100, // Преобразуем из процентов
                    warehouse: warehouseName,
                    geoName: geoName,
                    type: "storage",
                    raw: warehouse,
                });
            }
            
            // Коэффициенты доставки (boxDeliveryCoefExpr)
            if (warehouse.boxDeliveryCoefExpr && warehouse.boxDeliveryCoefExpr !== "-") {
                tariffs.push({
                    box_type: `${geoName ? geoName + " - " : ""}${warehouseName} (доставка)`,
                    coefficient: parseFloat(String(warehouse.boxDeliveryCoefExpr)) / 100, // Преобразуем из процентов
                    warehouse: warehouseName,
                    geoName: geoName,
                    type: "delivery",
                    raw: warehouse,
                });
            }
        }
    } else if (Array.isArray(data)) {
        return data;
    } else if (data.data && Array.isArray(data.data)) {
        return data.data;
    } else if (data.tariffs && Array.isArray(data.tariffs)) {
        return data.tariffs;
    }
    
    return tariffs;
}

/**
 * Сохранение тарифов в БД на текущий день
 * Данные за день обновляются (upsert)
 */
export async function saveTariffsToDB(): Promise<void> {
    try {
        const tariffs = await fetchWBTariffs();
        const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

        // Транзакция для атомарности операций
        await knex.transaction(async (trx) => {
            for (const tariff of tariffs) {
                const boxType = String(tariff.box_type || tariff.boxType || "unknown");
                const coefficient = parseFloat(String(tariff.coefficient || tariff.coef || 0));

                // Upsert: обновляем если существует, иначе создаем
                await trx("wb_tariffs")
                    .insert({
                        date: today,
                        box_type: boxType,
                        coefficient: coefficient,
                        raw_data: tariff,
                        updated_at: knex.fn.now(),
                    })
                    .onConflict(["date", "box_type"])
                    .merge({
                        coefficient: coefficient,
                        raw_data: tariff,
                        updated_at: knex.fn.now(),
                    });
            }
        });

        console.log(`Успешно сохранено ${tariffs.length} тарифов за ${today}`);
    } catch (error) {
        console.error("Ошибка при сохранении тарифов в БД:", error);
        throw error;
    }
}

