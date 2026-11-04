import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const ok = await isValidSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: [
    // Tout sauf : assets, login, manifest/icônes, service worker, flux calendrier (protégé par jeton)
    "/((?!_next/static|_next/image|login|api/calendar|manifest.webmanifest|sw.js|icons/|favicon.ico|apple-icon.png|icon.png|offline.html).*)",
  ],
};
