import type { Desfecho, Report } from "./contexto"

/** O que o servidor recebe. Sem conta e sem usuario: quem decide isso e ele. */
export interface EventoDeProduto {
    name: string
    properties: Record<string, unknown>
}

/**
 * O que `load_ms` esta medindo naquela linha.
 *
 * `dados`/`vazio`/`erro`: uma regiao de dados resolveu, e o numero e o tempo
 * ate ela. `pintura`: a tela nao tem regiao nenhuma (landing, paginas legais, e
 * toda tela que a Secao 8 ainda nao migrou), e o numero e o tempo ate pintar.
 * `abandonado`: havia regiao, e o usuario saiu antes de ela resolver — o numero
 * e o tempo que ele esperou sem receber o dado.
 *
 * Sem este campo, as cinco situacoes moram na mesma coluna e quem consultar
 * soma laranja com maca.
 */
export type MedidoAte = "dados" | "vazio" | "erro" | "pintura" | "abandonado"

/**
 * De onde o cronometro partiu.
 *
 * O orcamento da spec e "clique -> dados na tela", e o commit da rota acontece
 * depois do clique. Quando da para ancorar no clique, ancora; quando nao da
 * (URL digitada, recarga, router.push), mede do commit — e o campo diz qual dos
 * dois, porque um numero que as vezes mede de um ponto e as vezes de outro sem
 * dizer de qual e exatamente o defeito que esta secao conserta.
 */
export type MedidoDe = "clique" | "commit"

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/**
 * `/projects/<uuid>` vira `/projects/[id]`.
 *
 * Sem isso a cardinalidade da coluna `screen` explode — uma linha por projeto
 * visitado — e um id de dado do cliente vaza para dentro do nome do evento.
 */
export function normalizarTela(caminho: string): string {
    return caminho.replace(UUID, "[id]")
}

export function decidirMedicao(report: Report | null, houveAnuncio: boolean): MedidoAte {
    if (report) return report.desfecho
    return houveAnuncio ? "abandonado" : "pintura"
}

/** `null` e "nao sei", que e diferente de "nao esta vazia". */
export function vazioDoDesfecho(desfecho: Desfecho | null): boolean | null {
    if (desfecho === "vazio") return true
    if (desfecho === "dados") return false
    return null
}
