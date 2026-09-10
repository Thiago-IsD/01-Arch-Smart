/**
 * Caracterizacao do ProjectWizard — descreve o que ele faz HOJE.
 *
 * Escrito ANTES da quebra da Tarefa 9 da Secao 6, e verde na primeira
 * execucao sem nenhuma linha de producao tocada. Se algum destes precisar
 * de edicao para voltar a passar depois da quebra, o comportamento mudou:
 * desfaz a quebra, nao ajusta o teste.
 *
 * Detalhe do presente que os testes exploram: as tres etapas ficam TODAS no
 * DOM o tempo todo — o que muda por etapa e a classe `hidden`, que o jsdom
 * nao aplica. Por isso a etapa corrente e observada pelos botoes do rodape
 * (Cancelar/Voltar, Proximo/Criar Projeto), e nao pela presenca dos campos.
 */
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { ProjectWizard } from "@/components/projects/ProjectWizard"

const refresh = vi.fn()
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
    usePathname: () => "/projects",
}))

const toast = vi.fn()
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))

vi.mock("@/lib/api/auth", () => ({ getAccessToken: async () => "token-de-teste" }))

const fetchMock = vi.fn()

beforeAll(() => {
    // O Radix Select usa APIs de ponteiro que o jsdom nao implementa.
    Element.prototype.hasPointerCapture = vi.fn(() => false) as never
    Element.prototype.setPointerCapture = vi.fn() as never
    Element.prototype.releasePointerCapture = vi.fn() as never
    Element.prototype.scrollIntoView = vi.fn() as never
})

beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "novo" }) })
    vi.stubGlobal("fetch", fetchMock)
})

const onOpenChange = vi.fn()

function abrir(props: Record<string, unknown> = {}) {
    return render(<ProjectWizard isOpen onOpenChange={onOpenChange} {...props} />)
}

async function escolherNoSelect(
    usuario: ReturnType<typeof userEvent.setup>,
    gatilho: HTMLElement,
    opcao: string | RegExp,
) {
    await usuario.click(gatilho)
    await usuario.click(await screen.findByRole("option", { name: opcao }))
}

describe("ProjectWizard (caracterizacao — descreve o presente)", () => {
    it("no modo create abre no passo 1, com titulo e rodape de criacao", () => {
        abrir()
        expect(screen.getByRole("heading", { name: "Novo Projeto" })).toBeInTheDocument()
        expect(screen.getByText("Preencha os dados em etapas para abrir um novo projeto.")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Próximo/ })).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Criar Projeto/ })).not.toBeInTheDocument()
    })

    it("no modo edit muda titulo, descricao e o botao final, e preenche com initialData", async () => {
        abrir({
            mode: "edit",
            initialData: {
                id: 7,
                name: "Casa da Praia",
                service_type: "Design de Interiores",
                client: { name: "Maria Silva", email: "maria@ex.com", phone: "11999" },
                service_value: 5000,
                payment_installments: 2,
                payment_method: "STANDARD",
            },
        })
        expect(screen.getByRole("heading", { name: "Editar Projeto" })).toBeInTheDocument()
        expect(screen.getByText("Atualize as informações e detalhes do seu projeto.")).toBeInTheDocument()
        await waitFor(() => expect(screen.getByLabelText("Nome do Projeto")).toHaveValue("Casa da Praia"))
        expect(screen.getByLabelText("Nome do Cliente / Casal")).toHaveValue("Maria Silva")
        expect(screen.getByLabelText("E-mail do Cliente (Opcional)")).toHaveValue("maria@ex.com")
    })

    it("mostra os tres rotulos do stepper", () => {
        abrir()
        expect(screen.getByText("Projeto")).toBeInTheDocument()
        expect(screen.getByText("Cliente")).toBeInTheDocument()
        expect(screen.getByText("Financeiro")).toBeInTheDocument()
    })

    it("Proximo no passo 1 sem dados nao avanca e mostra as duas mensagens do schema", async () => {
        const usuario = userEvent.setup()
        abrir()
        await usuario.click(screen.getByRole("button", { name: /Próximo/ }))

        expect(await screen.findByText("Nome do projeto deve ter pelo menos 3 caracteres")).toBeInTheDocument()
        expect(screen.getByText("Selecione o tipo de serviço")).toBeInTheDocument()
        // Continua no passo 1: o rodape ainda oferece Cancelar.
        expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument()
    })

    it("Cancelar no passo 1 fecha o dialogo", async () => {
        const usuario = userEvent.setup()
        abrir()
        await usuario.click(screen.getByRole("button", { name: "Cancelar" }))
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it("com passo 1 valido avanca para o passo 2, e Voltar retorna ao passo 1", async () => {
        const usuario = userEvent.setup()
        abrir()
        await usuario.type(screen.getByLabelText("Nome do Projeto"), "Apartamento Jardins")
        await escolherNoSelect(usuario, screen.getByLabelText("Tipo de Serviço"), "Consultoria Express")
        await usuario.click(screen.getByRole("button", { name: /Próximo/ }))

        expect(await screen.findByRole("button", { name: /Voltar/ })).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument()

        await usuario.click(screen.getByRole("button", { name: /Voltar/ }))
        expect(await screen.findByRole("button", { name: "Cancelar" })).toBeInTheDocument()
    })

    it("no passo 3 o cronograma personalizado aparece so quando o recebimento e CUSTOM", async () => {
        const usuario = userEvent.setup()
        abrir()
        expect(screen.queryByText("Cronograma Personalizado")).not.toBeInTheDocument()
        await escolherNoSelect(usuario, screen.getByLabelText("Tipo de Recebimento"), /Personalizado/)
        expect(await screen.findByText("Cronograma Personalizado")).toBeInTheDocument()
        // Uma linha por parcela, e o total confrontado com o valor do servico.
        expect(screen.getByText("Parcela 1")).toBeInTheDocument()
        expect(screen.getByText("Soma das Parcelas:")).toBeInTheDocument()
    })

    it("envia POST /api/projects com o corpo do formulario e avisa por toast", async () => {
        const usuario = userEvent.setup()
        abrir()

        await usuario.type(screen.getByLabelText("Nome do Projeto"), "Apartamento Jardins")
        await escolherNoSelect(usuario, screen.getByLabelText("Tipo de Serviço"), "Consultoria Express")
        await usuario.click(screen.getByRole("button", { name: /Próximo/ }))

        await usuario.type(await screen.findByLabelText("Nome do Cliente / Casal"), "João e Maria")
        await usuario.click(screen.getByRole("button", { name: /Próximo/ }))

        const criar = await screen.findByRole("button", { name: /Criar Projeto/ })
        await usuario.click(criar)

        await waitFor(() => expect(fetchMock).toHaveBeenCalled())
        const [url, init] = fetchMock.mock.calls[0]
        expect(String(url)).toContain("/api/projects")
        expect(init.method).toBe("POST")
        expect(init.headers).toEqual({
            "Content-Type": "application/json",
            Authorization: "Bearer token-de-teste",
        })
        expect(JSON.parse(init.body)).toMatchObject({
            name: "Apartamento Jardins",
            service_type: "Consultoria Express",
            client_name: "João e Maria",
            payment_method: "STANDARD",
        })

        await waitFor(() => expect(toast).toHaveBeenCalledWith(
            expect.objectContaining({ title: "Projeto Criado" }),
        ))
        expect(onOpenChange).toHaveBeenCalledWith(false)
        expect(refresh).toHaveBeenCalled()
    })

    it("no modo edit envia PUT para /api/projects/<id>", async () => {
        const usuario = userEvent.setup()
        abrir({
            mode: "edit",
            initialData: {
                id: 7,
                name: "Casa da Praia",
                service_type: "Consultoria Express",
                client: { name: "Maria Silva" },
                service_value: 5000,
                payment_installments: 1,
                payment_method: "STANDARD",
            },
        })
        await waitFor(() => expect(screen.getByLabelText("Nome do Projeto")).toHaveValue("Casa da Praia"))
        await usuario.click(screen.getByRole("button", { name: /Próximo/ }))
        await usuario.click(await screen.findByRole("button", { name: /Próximo/ }))
        await usuario.click(await screen.findByRole("button", { name: /Salvar Alterações/ }))

        await waitFor(() => expect(fetchMock).toHaveBeenCalled())
        const [url, init] = fetchMock.mock.calls[0]
        expect(String(url)).toContain("/api/projects/7")
        expect(init.method).toBe("PUT")
        await waitFor(() => expect(toast).toHaveBeenCalledWith(
            expect.objectContaining({ title: "Projeto Atualizado" }),
        ))
    })

    it("403 vira o toast de Limite de Plano, com a frase que a API mandou", async () => {
        fetchMock.mockResolvedValue({
            ok: false,
            status: 403,
            json: async () => ({ detail: "Seu plano permite 2 projetos." }),
        })
        const usuario = userEvent.setup()
        abrir()
        await usuario.type(screen.getByLabelText("Nome do Projeto"), "Apartamento Jardins")
        await escolherNoSelect(usuario, screen.getByLabelText("Tipo de Serviço"), "Consultoria Express")
        await usuario.click(screen.getByRole("button", { name: /Próximo/ }))
        await usuario.type(await screen.findByLabelText("Nome do Cliente / Casal"), "João e Maria")
        await usuario.click(screen.getByRole("button", { name: /Próximo/ }))
        await usuario.click(await screen.findByRole("button", { name: /Criar Projeto/ }))

        await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({
            variant: "destructive",
            title: "Limite de Plano",
            description: "Seu plano permite 2 projetos.",
        })))
        expect(onOpenChange).not.toHaveBeenCalledWith(false)
    })

    it("submit invalido chama o toast de 'Confira os campos' e nao chama a API", async () => {
        const usuario = userEvent.setup()
        abrir()
        // Chega ao passo 3 pelo modo edit-like: preenche o minimo dos passos 1 e 2,
        // e depois apaga o nome do projeto para invalidar o formulario inteiro.
        await usuario.type(screen.getByLabelText("Nome do Projeto"), "Apartamento Jardins")
        await escolherNoSelect(usuario, screen.getByLabelText("Tipo de Serviço"), "Consultoria Express")
        await usuario.click(screen.getByRole("button", { name: /Próximo/ }))
        await usuario.type(await screen.findByLabelText("Nome do Cliente / Casal"), "João e Maria")
        await usuario.click(screen.getByRole("button", { name: /Próximo/ }))
        await usuario.clear(screen.getByLabelText("Nome do Projeto"))

        await usuario.click(await screen.findByRole("button", { name: /Criar Projeto/ }))

        await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({
            variant: "destructive",
            title: "Confira os campos",
        })))
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("o rodape do passo 3 mostra o total das parcelas contra o valor do servico", async () => {
        const usuario = userEvent.setup()
        const { container } = abrir()
        await escolherNoSelect(usuario, screen.getByLabelText("Tipo de Recebimento"), /Personalizado/)
        const soma = await screen.findByText("Soma das Parcelas:")
        const linha = soma.parentElement as HTMLElement
        expect(within(linha).getByText(/R\$ 0\.00 \/ R\$ 0\.00/)).toBeInTheDocument()
        expect(container).toBeTruthy()
    })
})
