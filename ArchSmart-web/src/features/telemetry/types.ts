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
 * toda tela que a Secao 8 ainda nao migrou). `abandonado`: havia regiao, e o
 * usuario saiu antes de ela resolver — o numero e o tempo que ele esperou sem
 * receber o dado.
 *
 * Duas ressalvas no `pintura`, para o numero nao ser lido como mais do que e:
 * o fim e o primeiro frame pintado **quando esse frame chegou a rodar** — em
 * aba oculta, ou se a tela desmontar antes dele, o fim e a saida da tela, e o
 * numero fica maior do que a pintura levou. E o inicio e o clique so quando deu
 * para ancorar nele; em carga dura (URL digitada, recarga) e o commit do efeito,
 * ja depois do time origin do documento, entao o tempo de rede e de boot do
 * bundle nao estao dentro. `medido_de` diz qual dos dois inicios foi usado.
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
