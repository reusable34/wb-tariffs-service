/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex) {
    return knex.schema.createTable("wb_tariffs", (table) => {
        table.increments("id").primary();
        table.date("date").notNullable();
        table.string("box_type").notNullable();
        table.decimal("coefficient", 10, 4).notNullable();
        table.jsonb("raw_data").nullable(); // для хранения полных данных из API
        table.timestamp("created_at").defaultTo(knex.fn.now());
        table.timestamp("updated_at").defaultTo(knex.fn.now());
        
        // Уникальный индекс для обновления данных за день
        table.unique(["date", "box_type"]);
        // Индекс для быстрого поиска по дате
        table.index("date");
    });
}

/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex) {
    return knex.schema.dropTable("wb_tariffs");
}


