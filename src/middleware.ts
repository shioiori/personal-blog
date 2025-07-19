import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest } from "next/server";

const intlMiddleware = createMiddleware(routing);
export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"]
};

export async function middleware(req: NextRequest) {
  return intlMiddleware(req);
}
