import Database from "@tauri-apps/plugin-sql";

const DEFAULT_STRATEGY_DB =
  "sqlite:C:/Users/Usuario/Desktop/proyectos/poker_boss/data/poker_boss.db";
const DB_URL = process.env.POKER_BOSS_STRATEGY_DB
  ? `sqlite:${String(process.env.POKER_BOSS_STRATEGY_DB).replace(/\\/g, "/")}`
  : DEFAULT_STRATEGY_DB;
const KEY = "BTN_vs_SB_BB_FISH_FISH";

async function main() {
  const db = await Database.load(DB_URL);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS situations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await db.execute(
    `
    INSERT INTO situations (key, created_at, updated_at)
    VALUES (?1, datetime('now'), datetime('now'))
    ON CONFLICT(key) DO UPDATE SET updated_at = datetime('now');
  `,
    [KEY]
  );

  const rows = await db.select(`
    SELECT id, key, created_at, updated_at
    FROM situations
    WHERE key = ?1
    LIMIT 1;
  `, [KEY]);

  console.log("OK inserted/updated:", rows);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
