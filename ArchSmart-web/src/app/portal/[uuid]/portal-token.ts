/**
 * Token de acesso ao portal do cliente.
 *
 * O portal guarda o token recebido no verify-password em localStorage,
 * chaveado por apresentação. Todo componente que chama uma ação do portal
 * (selecionar, aprovar, recusar, aceitar, ler comentários) precisa enviar
 * esse token — senão a API responde 401.
 */

export const tokenKey = (uuid: string) => `portal_token_${uuid}`

/**
 * Monta o header Authorization a partir do token guardado, quando existe.
 * Sem token (ou fora do browser), devolve um objeto vazio — o fetch segue
 * sem o header e a API responde 401, como já acontecia antes desta correção.
 */
export function cabecalhoDoPortal(uuid: string): HeadersInit {
    const token = typeof window !== "undefined" ? localStorage.getItem(tokenKey(uuid)) : null
    return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Limpa o token da apresentação e recarrega a página.
 *
 * Usar quando uma ação do portal responde 401: o token guardado expirou ou
 * foi revogado, e insistir nele só devolve o mesmo erro. Ao recarregar sem
 * token, o portal volta sozinho para o portão de senha (mesmo caminho que
 * `PortalClient` já percorre quando o GET inicial chega com `locked: true`).
 */
export function limparTokenEVoltarAoPortao(uuid: string): void {
    if (typeof window === "undefined") return
    localStorage.removeItem(tokenKey(uuid))
    window.location.reload()
}
