import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    );
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Public Routes (Allow access without login)
    const publicRoutes = [
        "/",
        "/produto",
        "/precos",
        "/web-clipper",
        "/sobre",
        "/termos",
        "/privacidade",
        "/legal",
        "/beta",
        "/beta/register",
        "/auth/login",
        "/auth/register",
        "/auth/verify", // <--- CRITICAL: Magic Link lands here
        "/auth/recover",
        "/auth/reset-password",
        "/auth/callback", // Supabase Auth Callback
    ];

    const isPublicRoute = publicRoutes.some((route) => {
        if (route === "/") {
            return request.nextUrl.pathname === "/";
        }
        return request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(route + "/");
    });

    // Allow static assets and API routes to pass through
    if (
        request.nextUrl.pathname.startsWith("/_next") ||
        request.nextUrl.pathname.startsWith("/api") ||
        request.nextUrl.pathname.startsWith("/static") ||
        request.nextUrl.pathname.includes(".") // Files like favicon.ico, etc.
    ) {
        return response;
    }

    // CRITICAL: Allow auth callback routes to process tokens from URL fragments
    // These routes handle magic links and password resets with tokens in the hash
    const authCallbackRoutes = ["/auth/verify", "/auth/callback", "/auth/reset-password"];
    if (authCallbackRoutes.some(route => request.nextUrl.pathname === route)) {
        return response;
    }

    // Redirect Logic
    if (!user && !isPublicRoute) {
        // If user is not logged in and tries to access a protected route, redirect to login
        return NextResponse.redirect(new URL("/auth/login", request.url));
    }

    if (user && request.nextUrl.pathname.startsWith("/auth/login")) {
        // If user IS logged in and tries to access login, send to dashboard
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
};
