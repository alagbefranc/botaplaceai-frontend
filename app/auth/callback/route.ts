import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") || "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login", origin));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const response = NextResponse.redirect(new URL("/onboarding", origin));

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/auth/login?error=callback_failed", origin));
  }

  // Bootstrap account (creates org/user record if first login)
  try {
    // We can't easily call our own API route from a route handler,
    // so we'll let the onboarding page handle bootstrap on load.
  } catch {}

  // Check if onboarding is already completed
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: userData } = await supabase
      .from("users")
      .select("org_id")
      .eq("id", user.id)
      .maybeSingle();

    if (userData?.org_id) {
      const { data: orgData } = await supabase
        .from("organizations")
        .select("onboarding_completed")
        .eq("id", userData.org_id)
        .maybeSingle();

      if (orgData?.onboarding_completed) {
        // Already onboarded, set cookie and go to redirect
        const redirectResponse = NextResponse.redirect(new URL(redirect, origin));
        // Copy auth cookies from the exchange
        response.cookies.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie.name, cookie.value);
        });
        redirectResponse.cookies.set("bo-onboarding-done", "1", {
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
          httpOnly: false,
          sameSite: "lax",
        });
        return redirectResponse;
      }
    }
  }

  return response;
}
