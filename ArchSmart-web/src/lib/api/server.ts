import { criarCliente, type ClienteApi } from "@/lib/api/core"
import { getServerAccessToken } from "@/lib/api/auth.server"

/**
 * Cliente para Server Component e Route Handler. Mesmo comportamento do `api`
 * do browser; muda so de onde vem o token — cookie, via `next/headers`.
 *
 * Arquivo separado porque `auth.server.ts` importa `next/headers`, que nao
 * pode ser alcancado por bundle de cliente.
 */
export const apiServer: ClienteApi = criarCliente({ resolverToken: getServerAccessToken })
