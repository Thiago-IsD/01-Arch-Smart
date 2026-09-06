import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ROTAS_PUBLICAS = [
    "/", "/produto", "/precos", "/web-clipper", "/sobre", "/termos",
    "/privacidade", "/legal", "/beta", "/beta/register", "/portal",
    "/auth/login", "/auth/register", "/auth/verify", "/auth/recover",
    "/auth/reset-password", "/auth/callback",
];

/** Rotas que processam token vindo do fragmento da URL — nao podem redirecionar. */
const CALLBACKS_DE_AUTH = ["/auth/verify", "/auth/callback", "/auth/reset-password"];

export function ehEstatico(pathname: string): boolean {
    return (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/api") ||
        pathname.startsWith("/static") ||
        pathname.startsWith("/assets") ||
        pathname.includes(".")
    );
}

export function ehRotaPublica(pathname: string): boolean {
    return ROTAS_PUBLICAS.some((rota) =>
        rota === "/" ? pathname === "/" : pathname === rota || pathname.startsWith(`${rota}/`),
    );
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // ORDEM IMPORTA, e esta e a correcao da Secao 5: o desvio de estatico e de
    // /api acontece ANTES de montar o cliente Supabase e chamar getUser().
    // Antes, toda requisicao de imagem, chunk de JS e chamada de API pagava uma
    // ida ao Supabase para validar token que ela nem usaria.
    if (ehEstatico(pathname)) return NextResponse.next();
    if (CALLBACKS_DE_AUTH.includes(pathname)) return NextResponse.next();

    let response = NextResponse.next({ request: { headers: request.headers } });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    response = NextResponse.next({ request: { headers: request.headers } });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options),
                    );
                },
            },
        },
    );

    // getUser() fica: e a verificacao real do token contra o Supabase. Trocar
    // por getSession() aqui seria trocar seguranca por velocidade — o cookie
    // sozinho nao prova nada.
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user && !ehRotaPublica(pathname)) {
        return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    if (user && pathname.startsWith("/auth/login")) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return response;
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|assets|favicon.ico).*)"],
};
