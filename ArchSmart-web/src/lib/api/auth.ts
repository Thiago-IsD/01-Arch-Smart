"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { env } from "@/lib/env"

/**
 * O unico arquivo do browser que sabe que o Supabase existe.
 *
 * Superficie deliberadamente pequena: medido em 06/09/2026, o front inteiro
 * usa quatro metodos de auth (`getSession` 56x, `signOut` 2x, `setSession` 2x,
 * `getUser` 2x), zero `storage` e zero `from()`. Login e cadastro ja passam
 * pela API. Trocar Supabase por Cognito e reescrever estas quatro funcoes e o
 * irmao `auth.server.ts` — nada mais.
 *
 * O cliente e memoizado: `createBrowserClient` monta listeners de storage e
 * um timer de refresh, e chamar de novo a cada `getAccessToken()` vazava os
 * dois. Eram 62 `createClient()` espalhados antes desta secao.
 */
let cliente: SupabaseClient | undefined

export function supabaseBrowser(): SupabaseClient {
    if (!cliente) {
        cliente = createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    }
    return cliente
}

export async function getAccessToken(): Promise<string | undefined> {
    const { data } = await supabaseBrowser().auth.getSession()
    return data.session?.access_token
}

export async function signOut(): Promise<void> {
    await supabaseBrowser().auth.signOut()
}

export async function setSession(tokens: {
    access_token: string
    refresh_token: string
}): Promise<void> {
    const { error } = await supabaseBrowser().auth.setSession(tokens)
    if (error) throw error
}
