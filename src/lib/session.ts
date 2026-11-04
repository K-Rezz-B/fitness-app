import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, isValidSession } from "./auth";

/** Défense en profondeur (le proxy filtre déjà) + rend la page dynamique. */
export async function requireAuth() {
  const store = await cookies();
  if (!(await isValidSession(store.get(SESSION_COOKIE)?.value))) redirect("/login");
}
