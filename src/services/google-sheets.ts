import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import env from "#config/env/env.js";
import knex from "#postgres/knex.js";
import { readFileSync } from "fs";
import { join } from "path";
import https from "https";
import jwt from "jsonwebtoken";

/**
 * Получение времени от Google сервера для синхронизации
 */
async function getGoogleServerTime(): Promise<Date> {
    return new Promise((resolve, reject) => {
        https.get('https://www.googleapis.com', (res) => {
            const dateHeader = res.headers.date;
            if (dateHeader) {
                const googleTime = new Date(dateHeader);
                console.log(`🕐 Время Google сервера: ${googleTime.toISOString()}`);
                resolve(googleTime);
            } else {
                reject(new Error('Не удалось получить время от Google'));
            }
        }).on('error', reject);
    });
}

/**
 * Инициализация Google Sheets API клиента с правильным временем
 */
async function getSheetsClient(googleServerTime?: Date) {
    console.log("🔄 Инициализация Google Sheets клиента...");
    
    const credentialsPath = join(process.cwd(), "google-credentials.json");
    
    let credentials;
    try {
        const credentialsJson = readFileSync(credentialsPath, "utf-8");
        credentials = JSON.parse(credentialsJson);
        console.log("✅ Credentials загружены");
    } catch (error) {
        throw new Error(`Файл google-credentials.json не найден или невалиден: ${credentialsPath}`);
    }

    // Если есть время от Google, создаем JWT вручную с правильным временем
    if (googleServerTime) {
        let privateKey = credentials.private_key;
        if (privateKey.includes('\\n')) {
            privateKey = privateKey.replace(/\\n/g, '\n');
        }

        // Создаем JWT с временем от Google сервера
        const now = Math.floor(googleServerTime.getTime() / 1000);
        const payload = {
            iss: credentials.client_email,
            sub: credentials.client_email,
            aud: 'https://oauth2.googleapis.com/token',
            scope: 'https://www.googleapis.com/auth/spreadsheets',
            iat: now,
            exp: now + 3600, // 1 час
        };

        const assertion = jwt.sign(payload, privateKey, { algorithm: 'RS256' });
        
        // Обмениваем JWT на access token
        return new Promise((resolve, reject) => {
            const postData = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${encodeURIComponent(assertion)}`;
            const options = {
                hostname: 'oauth2.googleapis.com',
                port: 443,
                path: '/token',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk.toString(); });
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const tokenData = JSON.parse(data);
                            console.log("✅ Access token получен успешно!");
                            
                            // Используем OAuth2Client с access token
                            const auth = new OAuth2Client();
                            auth.setCredentials({
                                access_token: tokenData.access_token,
                                token_type: tokenData.token_type,
                                expiry_date: Date.now() + (tokenData.expires_in * 1000),
                            });
                            
                            resolve(google.sheets({ version: "v4", auth }));
                        } catch (parseError: any) {
                            reject(new Error(`Ошибка парсинга ответа: ${parseError.message} - ${data}`));
                        }
                    } else {
                        reject(new Error(`Ошибка получения токена (${res.statusCode}): ${data}`));
                    }
                });
            });

            req.on('error', reject);
            req.write(postData);
            req.end();
        }) as Promise<any>;
    }

    // Иначе используем стандартный метод
    const auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    return google.sheets({ version: "v4", auth });
}

/**
 * Альтернативная версия с явным указанием credentials
 */
function getSheetsClientAlternative() {
    console.log("🔄 Альтернативная инициализация Google Sheets клиента...");
    
    const credentialsPath = join(process.cwd(), "google-credentials.json");
    
    let credentials;
    try {
        const credentialsJson = readFileSync(credentialsPath, "utf-8");
        credentials = JSON.parse(credentialsJson);
    } catch (error: any) {
        throw new Error(`Файл google-credentials.json не найден: ${error.message}`);
    }

    // Правильно обрабатываем private_key
    let privateKey = credentials.private_key;
    if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
    }

    // Используем GoogleAuth с credentials (только необходимые поля)
    const auth = new google.auth.GoogleAuth({
        credentials: {
            type: "service_account",
            private_key: privateKey,
            client_email: credentials.client_email,
        },
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    return google.sheets({ version: "v4", auth });
}

/**
 * Получение списка ID таблиц
 */
function getSpreadsheetIds(): string[] {
    const idsFromEnv = env.GOOGLE_SHEETS_SPREADSHEET_IDS;
    
    if (idsFromEnv) {
        const ids = idsFromEnv.split(",").map((id) => id.trim()).filter((id) => id.length > 0);
        console.log(`📋 Найдено таблиц из env: ${ids.length}`);
        return ids;
    }
    
    console.log("❌ ID таблиц не найдены в env");
    return [];
}

/**
 * Получение актуальных тарифов из БД
 */
async function getLatestTariffs() {
    const today = new Date().toISOString().split("T")[0];
    
    console.log(`📅 Поиск тарифов за: ${today}`);
    const tariffs = await knex("wb_tariffs")
        .where("date", today)
        .orderBy("coefficient", "asc")
        .select("box_type", "coefficient", "raw_data");

    console.log(`📊 Найдено тарифов: ${tariffs.length}`);
    return tariffs;
}

/**
 * Тестирование доступа к таблице
 */
async function testSpreadsheetAccess(sheets: any, spreadsheetId: string): Promise<boolean> {
    try {
        console.log(`🔐 Тестирование доступа к таблице: ${spreadsheetId}`);
        
        const response = await sheets.spreadsheets.get({
            spreadsheetId,
            fields: 'properties.title'
        });
        
        console.log(`✅ Доступ есть: "${response.data.properties?.title}"`);
        return true;
    } catch (error: any) {
        console.error(`❌ Нет доступа: ${error.message}`);
        return false;
    }
}

/**
 * Обновление данных в Google-таблице
 * @param spreadsheetId ID таблицы
 * @param sheetName Название листа (по умолчанию stocks_coefs)
 */
export async function updateGoogleSheet(
    spreadsheetId: string,
    sheetName: string = "stocks_coefs"
): Promise<void> {
    console.log(`\n🚀 Начало обновления таблицы: ${spreadsheetId}`);
    
    try {
        // Синхронизируем время с Google перед запросом
        let googleTime: Date | undefined;
        try {
            googleTime = await getGoogleServerTime();
            const localTime = new Date();
            const timeDiff = Math.abs(googleTime.getTime() - localTime.getTime()) / 1000;
            console.log(`🕐 Локальное время: ${localTime.toISOString()}`);
            console.log(`🕐 Разница с Google: ${timeDiff.toFixed(0)} секунд`);
            
            if (timeDiff > 300) {
                console.warn(`⚠️ ВНИМАНИЕ: Разница времени больше 5 минут! Используем время Google для JWT.`);
            }
        } catch (error) {
            console.warn(`⚠️ Не удалось синхронизировать время с Google: ${error}`);
        }

        // Пробуем основной метод с правильным временем
        let sheets;
        try {
            sheets = await getSheetsClient(googleTime);
        } catch (error) {
            console.log("🔄 Основной метод не сработал, пробуем альтернативный...");
            sheets = getSheetsClientAlternative();
        }

        // Пропускаем проверку доступа - попробуем сразу записать данные
        // Если будет ошибка, она проявится при попытке записи
        console.log("⏭️ Пропускаем проверку доступа, пробуем записать данные напрямую...");

        // Получаем данные
        const tariffs = await getLatestTariffs();
        if (tariffs.length === 0) {
            console.log(`❌ Нет данных для таблицы ${spreadsheetId}`);
            return;
        }

        // Подготовка данных
        const headers = ["Тип короба", "Коэффициент"];
        const rows = tariffs.map((tariff) => [
            tariff.box_type,
            tariff.coefficient.toString(),
        ]);

        console.log(`📝 Подготовлено ${rows.length} строк данных`);

        // Пробуем получить информацию о таблице, но не падаем сразу при ошибке
        let spreadsheetInfo;
        let sheetExists = false;
        try {
            spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
            console.log(`✅ Таблица найдена: "${spreadsheetInfo.data.properties?.title}"`);
            sheetExists = spreadsheetInfo.data.sheets?.some(
                (sheet: any) => sheet.properties?.title === sheetName
            ) || false;
        } catch (error: any) {
            if (error.code === 404 || error.message.includes('not found')) {
                console.warn(`⚠️ Не удалось получить информацию о таблице (404), пробуем записать данные напрямую...`);
                // Продолжаем - попробуем записать данные напрямую
                sheetExists = false;
            } else {
                throw error;
            }
        }

        if (!sheetExists) {
            console.log(`➕ Создаем лист: ${sheetName}`);
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [
                        {
                            addSheet: {
                                properties: {
                                    title: sheetName,
                                },
                            },
                        },
                    ],
                },
            });
        }

        // Очищаем лист
        console.log(`🧹 Очищаем лист ${sheetName}`);
        try {
            await sheets.spreadsheets.values.clear({
                spreadsheetId,
                range: `${sheetName}!A:Z`,
            });
        } catch (error) {
            // Игнорируем ошибку очистки пустого листа
        }

        // Записываем данные
        console.log(`📤 Записываем данные...`);
        const result = await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: "RAW",
            requestBody: {
                values: [headers, ...rows],
            },
        });

        console.log(`✅ Успешно обновлено: ${result.data.updatedCells} ячеек`);
        console.log(`🎉 Таблица ${spreadsheetId} обновлена!`);

    } catch (error: any) {
        console.error(`💥 Ошибка при обновлении ${spreadsheetId}:`, error.message);
        
        // Детальная диагностика ошибки JWT
        if (error.message.includes('invalid_grant') || error.message.includes('JWT')) {
            console.log('🔧 Диагностика JWT ошибки:');
            console.log('   - Проверьте время на сервере (должно быть синхронизировано)');
            console.log('   - Убедитесь что Service Account добавлен в таблицу');
            console.log('   - Проверьте что ключ не истек');
        }
        
        throw error;
    }
}

/**
 * Обновление всех Google-таблиц из БД
 */
export async function updateAllGoogleSheets(): Promise<void> {
    console.log("🔄 ЗАПУСК ОБНОВЛЕНИЯ ВСЕХ ТАБЛИЦ");
    
    try {
        const spreadsheetIds = getSpreadsheetIds();

        if (spreadsheetIds.length === 0) {
            console.log("❌ Нет ID таблиц для обновления");
            return;
        }

        console.log(`📋 Обрабатываем ${spreadsheetIds.length} таблиц`);

        let successCount = 0;
        let errorCount = 0;

        for (const spreadsheetId of spreadsheetIds) {
            try {
                await updateGoogleSheet(spreadsheetId);
                successCount++;
            } catch (error) {
                console.error(`❌ Ошибка таблицы ${spreadsheetId}:`, error);
                errorCount++;
            }
        }

        console.log(`\n📊 ИТОГ: Успешно: ${successCount}, Ошибок: ${errorCount}`);

    } catch (error) {
        console.error("💥 Критическая ошибка:", error);
        throw error;
    }
}

/**
 * Функция для проверки времени сервера
 */
export function checkServerTime() {
    const now = new Date();
    console.log(`🕐 Текущее время сервера: ${now.toISOString()}`);
    console.log(`🕐 Локальное время: ${now.toString()}`);
    return now;
}

