/** O que o servidor recebe. Sem conta e sem usuario: quem decide isso e ele. */
export interface EventoDeProduto {
    name: string
    properties: Record<string, unknown>
}

/**
 * `dados` = o tempo ate os dados aparecerem, que e a metrica do orcamento de
 * performance. `pintura` = o tempo ate a tela pintar, que e outra coisa. As
 * duas moram na mesma coluna `load_ms`, e sem este campo quem consultar depois
 * soma laranja com maca.
 */
export type MedidoAte = "dados" | "pintura"

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

export function decidirMedicao(estado: { queriesAssentaram: boolean }): MedidoAte {
    return estado.queriesAssentaram ? "dados" : "pintura"
}
