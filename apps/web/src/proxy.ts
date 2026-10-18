import { NextResponse, type NextRequest } from "next/server";

/** Judges reach the shop through these; they stay open even when the control room is locked. */
const PUBLIC = ["/join", "/api/join"];

/**
 * Locks the control room, its actions, and the leads list behind HTTP Basic auth once
 * CONTROL_ROOM_PASSWORD is set (any user name). Unset, nothing changes, so local demos keep working.
 */
export function proxy(request: NextRequest) {
  const password = process.env.CONTROL_ROOM_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname } = request.nextUrl;
  // The landing page is the front door; its login button leads into the locked shop.
  if (pathname === "/" && !request.nextUrl.search) return NextResponse.next();
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      // "user:password", and the password itself may contain colons.
      const pair = atob(header.slice(6));
      if (pair.slice(pair.indexOf(":") + 1) === password) return NextResponse.next();
    } catch {
      // A malformed header is just a wrong password.
    }
  }

  return new NextResponse("This control room is private.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Back of House", charset="UTF-8"' },
  });
}

export const config = {
  // Everything except Next's own assets and the files a shared link needs to render a preview.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|opengraph-image).*)"],
};
