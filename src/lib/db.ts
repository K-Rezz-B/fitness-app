import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DB = PostgresJsDatabase<typeof schema>;
const g = globalThis as unknown as { __db?: DB };

function create(): DB {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL manquant (voir README)");
  // prepare:false → compatible avec le pooler Neon (PgBouncer, mode transaction)
  return drizzle(postgres(url, { prepare: false, max: 1 }), { schema });
}

/** Instanciation paresseuse : aucune connexion au build. */
export const db = new Proxy({} as DB, {
  get(_t, prop) {
    g.__db ??= create();
    return Reflect.get(g.__db, prop, g.__db);
  },
});
