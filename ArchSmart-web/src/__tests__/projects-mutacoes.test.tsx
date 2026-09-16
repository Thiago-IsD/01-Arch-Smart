import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { queryKeys } from "@/lib/query/keys"
import {
    useCriarAmbiente,
    useCriarProjeto,
    useEditarProjeto,
    useExcluirAmbiente,
    useExcluirProjeto,
    useMudarStatusDoProjeto,
    useSalvarDna,
} from "@/features/projects/hooks"

vi.mock("@/lib/api/auth", () => ({ getAccessToken: async () => "tok" }))

/**
 * Cada mutacao afirma o CONJUNTO EXATO de chaves que invalida e descarta.
 * Conjunto, nao "contem": acrescentar uma chave a mais (custo de rede a 0,17 s
 * por ida ao banco) reprova tanto quanto esquecer uma (tela mentindo). Foi o
 * esquecimento do Dashboard que abriu este teste: nenhuma mutacao invalidava
 * `dashboard.all` (item 7 do bloco do Dashboard no CLAUDE.md).
 */
function montar() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const invalidadas: string[] = []
    const descartadas: string[] = []
    const original = client.invalidateQueries.bind(client)
    client.invalidateQueries = ((filtros?: { queryKey?: QueryKey; refetchType?: string }, opcoes?: unknown) => {
        const chave = JSON.stringify(filtros?.queryKey)
        if (filtros?.refetchType === "none") descartadas.push(chave)
        else invalidadas.push(chave)
        return original(filtros as never, opcoes as never)
    }) as typeof client.invalidateQueries
    function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
    return { Wrapper, invalidadas, descartadas }
}

const ordenado = (chaves: readonly QueryKey[]) => chaves.map((c) => JSON.stringify(c)).sort()

function respostaOk(corpo: unknown = { id: "p1" }, status = 200) {
    return status === 204
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } })
}

const fetchMock = vi.fn()
beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(async () => respostaOk())
    vi.stubGlobal("fetch", fetchMock)
})

describe("mutacoes de projeto", () => {
    it("criar: POST /api/projects; invalida lists e dashboard; nao descarta nada", async () => {
        const { Wrapper, invalidadas, descartadas } = montar()
        const { result } = renderHook(() => useCriarProjeto(), { wrapper: Wrapper })

        await result.current.mutateAsync({ name: "Novo", client_name: "Ana" } as never)

        const [url, init] = fetchMock.mock.calls[0]
        expect(String(url)).toMatch(/\/api\/projects$/)
        expect(init.method).toBe("POST")
        expect(invalidadas.sort()).toEqual(ordenado([queryKeys.projects.lists(), queryKeys.dashboard.all]))
        expect(descartadas).toEqual([])
    })

    it("editar: PUT /api/projects/<id>; invalida lists, detail(id) e dashboard", async () => {
        const { Wrapper, invalidadas, descartadas } = montar()
        const { result } = renderHook(() => useEditarProjeto(), { wrapper: Wrapper })

        await result.current.mutateAsync({ id: "p1", dados: { name: "Outro" } as never })

        const [url, init] = fetchMock.mock.calls[0]
        expect(String(url)).toMatch(/\/api\/projects\/p1$/)
        expect(init.method).toBe("PUT")
        expect(invalidadas.sort()).toEqual(
            ordenado([queryKeys.projects.lists(), queryKeys.projects.detail("p1"), queryKeys.dashboard.all]),
        )
        expect(descartadas).toEqual([])
    })

    it("mudar status: PUT so com status; mesmo efeito de editar", async () => {
        const { Wrapper, invalidadas } = montar()
        const { result } = renderHook(() => useMudarStatusDoProjeto(), { wrapper: Wrapper })

        await result.current.mutateAsync({ id: "p1", status: "COMPLETED" })

        const [, init] = fetchMock.mock.calls[0]
        expect(JSON.parse(init.body)).toEqual({ status: "COMPLETED" })
        expect(invalidadas.sort()).toEqual(
            ordenado([queryKeys.projects.lists(), queryKeys.projects.detail("p1"), queryKeys.dashboard.all]),
        )
    })

    it("excluir: DELETE; invalida lists e dashboard; DESCARTA detail e environments sem rebuscar", async () => {
        fetchMock.mockImplementation(async () => respostaOk(undefined, 204))
        const { Wrapper, invalidadas, descartadas } = montar()
        const { result } = renderHook(() => useExcluirProjeto(), { wrapper: Wrapper })

        await result.current.mutateAsync("p1")

        expect(fetchMock.mock.calls[0][1].method).toBe("DELETE")
        expect(invalidadas.sort()).toEqual(ordenado([queryKeys.projects.lists(), queryKeys.dashboard.all]))
        expect(descartadas.sort()).toEqual(
            ordenado([queryKeys.projects.detail("p1"), queryKeys.projects.environments("p1")]),
        )
    })

    it("falha nao invalida nada e entrega ApiError com o status", async () => {
        fetchMock.mockImplementation(async () =>
            respostaOk({ detail: "Limite do plano atingido." }, 403),
        )
        const { Wrapper, invalidadas } = montar()
        const { result } = renderHook(() => useCriarProjeto(), { wrapper: Wrapper })

        await expect(result.current.mutateAsync({ name: "X" } as never)).rejects.toMatchObject({
            status: 403,
            message: "Limite do plano atingido.",
        })
        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(invalidadas).toEqual([])
    })
})

describe("mutacoes de ambiente", () => {
    it("criar ambiente: POST no projeto; invalida environments(id) e lists — nao dashboard, nao detail", async () => {
        fetchMock.mockImplementation(async () => respostaOk({ id: "e1", project_id: "p1", name: "Sala" }, 201))
        const { Wrapper, invalidadas, descartadas } = montar()
        const { result } = renderHook(() => useCriarAmbiente("p1"), { wrapper: Wrapper })

        await result.current.mutateAsync({ name: "Sala", type: "Interna/Seca", dna: { floor_area: 0, wall_area: 0, ceiling_area: 0 } })

        const [url, init] = fetchMock.mock.calls[0]
        expect(String(url)).toMatch(/\/api\/projects\/p1\/environments$/)
        expect(init.method).toBe("POST")
        expect(invalidadas.sort()).toEqual(ordenado([queryKeys.projects.environments("p1"), queryKeys.projects.lists()]))
        expect(descartadas).toEqual([])
    })

    it("excluir ambiente: DELETE no ambiente; mesmo efeito de criar", async () => {
        fetchMock.mockImplementation(async () => respostaOk(undefined, 204))
        const { Wrapper, invalidadas } = montar()
        const { result } = renderHook(() => useExcluirAmbiente("p1"), { wrapper: Wrapper })

        await result.current.mutateAsync("e1")

        const [url, init] = fetchMock.mock.calls[0]
        expect(String(url)).toMatch(/\/api\/environments\/e1$/)
        expect(init.method).toBe("DELETE")
        expect(invalidadas.sort()).toEqual(ordenado([queryKeys.projects.environments("p1"), queryKeys.projects.lists()]))
    })

    it("salvar DNA: PUT .../dna; invalida SO environments(id) — a contagem da lista nao muda", async () => {
        const { Wrapper, invalidadas } = montar()
        const { result } = renderHook(() => useSalvarDna("p1"), { wrapper: Wrapper })

        await result.current.mutateAsync({ envId: "e1", areas: { floor_area: 10, wall_area: 20, ceiling_area: 10 } })

        const [url, init] = fetchMock.mock.calls[0]
        expect(String(url)).toMatch(/\/api\/environments\/e1\/dna$/)
        expect(init.method).toBe("PUT")
        expect(JSON.parse(init.body)).toEqual({ floor_area: 10, wall_area: 20, ceiling_area: 10 })
        expect(invalidadas).toEqual(ordenado([queryKeys.projects.environments("p1")]))
    })
})
