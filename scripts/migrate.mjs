// Applique les migrations Drizzle. Lancé automatiquement avant `next build`.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) {
  console.warn("[migrate] DATABASE_URL absent → migrations ignorées");
  process.exit(0);
}
const sql = postgres(url, { max: 1, prepare: false });
await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
await sql.end();
console.log("[migrate] OK");
