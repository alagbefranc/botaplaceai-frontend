import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/status"];
const PUBLIC_PREFIXES = ["/landing", "/status"];
const AUTH_ROUTES_PREFIX = "/auth";
const ONBOARDING_ROUTE = "/onboarding";
const SKIP_PREFIXES = ["/api/", "/_next/", "/assets/", "/favicon", "/bota-logo"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets, API routes, and Next internals
  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Skip public file extensions
  if (/\.(svg|png|jpg|jpeg|gif|ico|webp|css|js|woff2?)$/.test(pathname)) {
    return NextResponse.next();
  }

  // Root path: show landing for visitors, redirect logged-in users to dashboard
  if (pathname === "/") {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseAnonKey) {
      let rootResponse = NextResponse.next({ request: { headers: request.headers } });
      const sb = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              rootResponse.cookies.set(name, value, options);
            });
          },
        },
      });
      const { data: { user: rootUser } } = await sb.auth.getUser();
      if (rootUser) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
    return NextResponse.next();
  }

  // Allow public routes
  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  // Allow public prefixes (e.g., /landing/*)
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow auth routes (signup, login, callback)
  if (pathname.startsWith(AUTH_ROUTES_PREFIX)) {
    return NextResponse.next();
  }

  // Allow onboarding route
  if (pathname.startsWith(ONBOARDING_ROUTE)) {
    return NextResponse.next();
  }

  // Create Supabase client for middleware
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not authenticated → redirect to signup
  if (!user) {
    const signupUrl = new URL("/auth/signup", request.url);
    signupUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signupUrl);
  }

  // Check if onboarding is completed (via cookie to avoid DB lookup every request)
  const onboardingDone = request.cookies.get("bo-onboarding-done")?.value === "1";

  // If cookie exists, user is good to go
  if (onboardingDone) {
    return response;
  }

  // No cookie - check if user has completed onboarding in DB
  // For existing users, we'll set the cookie and let them through
  try {
    const { data: userData } = await supabase
      .from("users")
      .select("org_id")
      .eq("id", user.id)
      .maybeSingle();

    // If user has an org_id, they've been through setup - set cookie and allow
    if (userData?.org_id) {
      response.cookies.set("bo-onboarding-done", "1", {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        httpOnly: false,
        sameSite: "lax",
      });
      return response;
    }

    // No user record yet - this is a new user, redirect to onboarding
    // But first, try to bootstrap their account
    // The onboarding page will handle the rest
  } catch {
    // DB error - allow through to avoid blocking existing users
    response.cookies.set("bo-onboarding-done", "1", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: false,
      sameSite: "lax",
    });
    return response;
  }

  // New user without org - redirect to onboarding
  const onboardingUrl = new URL("/onboarding", request.url);
  return NextResponse.redirect(onboardingUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
