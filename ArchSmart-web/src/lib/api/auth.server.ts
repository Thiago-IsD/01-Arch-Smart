import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { env } from "@/lib/env"

/**
 * Irmao servidor do `auth.ts`.
 *
 * Existe separado porque `next/headers` nao pode ser importado por bundle de
 * cliente — juntar os dois num arquivo so quebra o build do Next, nao e
 * questao de estilo. A spec pede "um arquivo"; a intencao (um ponto de troca
 * por Cognito) fica preservada por serem dois arquivos irmaos no mesmo
 * diretorio.
 */
export async function supabaseServer(): Promise<SupabaseClient> {
    const cookieStore = await cookies()

    return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        cookies: {
            getAll() {
                return cookieStore.getAll()
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options),
                    )
                } catch {
                    // Server Component nao pode escrever cookie. Quem renova a
                    // sessao e o proxy.ts, que roda em middleware e pode.
                }
            },
        },
    })
}

export async function getServerAccessToken(): Promise<string | undefined> {
    const { data } = await (await supabaseServer()).auth.getSession()
    return data.session?.access_token
}

export async function getServerUser(): Promise<User | null> {
    const { data } = await (await supabaseServer()).auth.getUser()
    return data.user
}
