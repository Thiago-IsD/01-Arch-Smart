import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { type ReactNode } from "react"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { EventoDeProduto } from "@/features/telemetry/types"
import { TelemetriaDeTela } from "@/features/telemetry/TelemetriaDeTela"
import { ProntidaoDaTelaProvider } from "@/features/telemetry/contexto"

// --- TelemetriaDeTela: DE ONDE o cronometro parte ---------------------------
//
// O orcamento da spec e "clique -> dados na tela", entao o cronometro ancora no
// clique quando da, e `medido_de` diz qual dos dois inicios foi usado. A marca
// do clique e global de modulo e so e consumida quando o `pathname` muda: um
// clique que NAO navega este documento vazava e ancorava a navegacao seguinte
// num instante velho. Os tres testes de recusa abaixo sao de defeito achado em
// revisao, nao hipotese — ver `(dashboard)/settings/page.tsx`, que abre Termos e
// Privacidade com `target="_blank"`.

const eventos: EventoDeProduto[] = []

vi.mock("@/lib/api/telemetry", () => ({
    enviarEventos: async (lote: EventoDeProduto[]) => {
        eventos.push(...lote)
    },
}))

let caminhoAtual = "/library"
vi.mock("next/navigation", () => ({
    usePathname: () => caminhoAtual,
}))

function clienteDeTeste() {
    return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

let cliente = clienteDeTeste()

function Envolvido({ children }: { children?: ReactNode }) {
    return (
        <QueryClientProvider client={cliente}>
            <ProntidaoDaTelaProvider>
                <TelemetriaDeTela />
                {children}
            </ProntidaoDaTelaProvider>
        </QueryClientProvider>
    )
}

describe("TelemetriaDeTela — ancora do cronometro", () => {
    beforeEach(() => {
        eventos.length = 0
        caminhoAtual = "/library"
        cliente = clienteDeTeste()
    })

    // O desmonte agenda a decisao do evento para o tick seguinte (ver o cleanup
    // do TelemetriaDeTela). O desmonte automatico do RTL roda DEPOIS do teste,
    // entao sem drenar esse tick aqui a linha de um teste cairia dentro do
    // proximo — e o `beforeEach` limparia o array antes de ela chegar.
    afterEach(async () => {
        cleanup()
        await new Promise((r) => setTimeout(r, 0))
    })

    // `medido_de` nasce nesta tarefa e e o campo que diz de ONDE o cronometro
    // partiu. Sem este teste, ele podia sair sempre "commit" — o valor que nao
    // depende de nada — e ninguem notaria: um numero que as vezes mede do
    // clique e as vezes do commit sem dizer de qual e o defeito que a Secao 8
    // conserta.
    it("ancora no clique em link interno, e diz isso em medido_de", async () => {
        const { rerender } = render(
            <Envolvido>
                {/* preventDefault imita o <Link> do Next, que intercepta o
                    clique e navega por roteador. E por isso que o ouvinte da
                    marca de clique fica na fase de CAPTURA: na de borbulha ele
                    viria depois deste handler. */}
                <a href="/dashboard" onClick={(e) => e.preventDefault()}>
                    ir
                </a>
            </Envolvido>
        )
        await new Promise((r) => setTimeout(r, 50))

        screen.getByRole("link", { name: "ir" }).click()
        caminhoAtual = "/dashboard"
        rerender(
            <Envolvido>
                {/* preventDefault imita o <Link> do Next, que intercepta o
                    clique e navega por roteador. E por isso que o ouvinte da
                    marca de clique fica na fase de CAPTURA: na de borbulha ele
                    viria depois deste handler. */}
                <a href="/dashboard" onClick={(e) => e.preventDefault()}>
                    ir
                </a>
            </Envolvido>
        )
        // A linha que saiu e a da tela ANTERIOR, descarregada pela navegacao
        // nova; ela foi medida do commit, porque nao houve clique antes dela.
        await waitFor(() => expect(eventos).toHaveLength(1))
        expect(eventos[0].properties.screen).toBe("/library")
        expect(eventos[0].properties.medido_de).toBe("commit")

        // A nova navegacao ancorou no clique.
        window.dispatchEvent(new Event("pagehide"))
        await waitFor(() => expect(eventos).toHaveLength(2))
        expect(eventos[1].properties.screen).toBe("/dashboard")
        expect(eventos[1].properties.medido_de).toBe("clique")
    })

    // CRITICO, pego na revisao: `marcaDeClique` era global de modulo e so era
    // zerada dentro do efeito — que so roda quando o `pathname` muda. Todo
    // clique em a[href^="/"] que NAO navega este documento ficava de pe
    // indefinidamente e ancorava a navegacao seguinte num instante velho.
    // O caso e real: (dashboard)/settings/page.tsx abre Termos e Privacidade
    // com target="_blank". Usuario le trinta segundos noutra aba, volta, clica
    // na Biblioteca — e o evento saia `medido_de: "clique"` cronometrando a
    // distracao dele.
    it("clique que nao navega este documento nao ancora a navegacao seguinte", async () => {
        caminhoAtual = "/settings"
        // Elemento novo a cada chamada: passar o MESMO objeto de elemento para
        // `rerender` faz o React pular a re-renderizacao por identidade, e o
        // efeito nunca veria o `pathname` novo.
        const comTermos = () => (
            <Envolvido>
                {/* preventDefault so para o jsdom nao tentar navegar; o ouvinte
                    da marca e de CAPTURA e ja rodou antes deste handler. */}
                <a href="/termos" target="_blank" onClick={(e) => e.preventDefault()}>
                    termos
                </a>
            </Envolvido>
        )
        const { rerender } = render(comTermos())
        await new Promise((r) => setTimeout(r, 50))

        // Abre os Termos noutra aba e FICA nesta.
        screen.getByRole("link", { name: "termos" }).click()

        // Navegacao posterior por outro caminho (router.push, URL digitada).
        caminhoAtual = "/library"
        rerender(comTermos())

        // Primeiro sai a linha de /settings, descarregada pela navegacao nova.
        await waitFor(() => expect(eventos).toHaveLength(1))
        expect(eventos[0].properties.screen).toBe("/settings")

        // E a de /library NAO pode estar ancorada no clique dos Termos.
        window.dispatchEvent(new Event("pagehide"))
        await waitFor(() => expect(eventos).toHaveLength(2))
        expect(eventos[1].properties.screen).toBe("/library")
        expect(eventos[1].properties.medido_de).toBe("commit")
    })

    // E este discrimina a CONFERENCIA DE DESTINO, que os dois testes acima nao
    // alcancam: neles o clique e recusado ja no ouvinte (target, modificador),
    // entao nem existe marca. Aqui o clique e limpo, interno e na mesma aba — a
    // marca E criada —, mas quem commitou foi outra tela. Caso real: o usuario
    // clica no item de nav da pagina em que ja esta (nada navega) e depois vai
    // para outra tela por um caminho que nao e link (router.push, formulario).
    it("clique no link da pagina ativa nao ancora a navegacao seguinte", async () => {
        const tela = () => (
            <Envolvido>
                <a href="/library" onClick={(e) => e.preventDefault()}>
                    biblioteca (ativa)
                </a>
            </Envolvido>
        )
        const { rerender } = render(tela())
        await new Promise((r) => setTimeout(r, 50))

        screen.getByRole("link", { name: "biblioteca (ativa)" }).click()

        caminhoAtual = "/projects"
        rerender(tela())
        await waitFor(() => expect(eventos).toHaveLength(1))
        expect(eventos[0].properties.screen).toBe("/library")

        window.dispatchEvent(new Event("pagehide"))
        await waitFor(() => expect(eventos).toHaveLength(2))
        expect(eventos[1].properties.screen).toBe("/projects")
        expect(eventos[1].properties.medido_de).toBe("commit")
    })

    // O teste acima passa so pela conferencia de destino (/termos != /library).
    // Este discrimina as guardas do OUVINTE: o href casa com o pathname que
    // commitou, entao a unica coisa que impede a ancora errada e o cmd+clique
    // ter sido recusado na origem.
    it("cmd+clique nao ancora, mesmo quando o destino casa com a navegacao", async () => {
        caminhoAtual = "/settings"
        const tela = () => (
            <Envolvido>
                <a href="/library" onClick={(e) => e.preventDefault()}>
                    biblioteca
                </a>
            </Envolvido>
        )
        const { rerender } = render(tela())
        await new Promise((r) => setTimeout(r, 50))

        // cmd+clique abre noutra aba: ESTE documento nao navega. `.click()` nao
        // carrega modificador, por isso o evento vai montado a mao.
        screen.getByRole("link", { name: "biblioteca" }).dispatchEvent(
            new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true })
        )

        caminhoAtual = "/library"
        rerender(tela())
        await waitFor(() => expect(eventos).toHaveLength(1))
        expect(eventos[0].properties.screen).toBe("/settings")

        window.dispatchEvent(new Event("pagehide"))
        await waitFor(() => expect(eventos).toHaveLength(2))
        expect(eventos[1].properties.screen).toBe("/library")
        expect(eventos[1].properties.medido_de).toBe("commit")
    })
})
