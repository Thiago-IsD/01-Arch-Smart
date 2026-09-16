"use client"

import { ProjectHeader } from "@/components/projects/ProjectHeader"
import { EnvironmentsWorkspace } from "@/components/projects/environments/EnvironmentsWorkspace"
import { QueryBoundary } from "@/components/ui/query-boundary"
import { Skeleton } from "@/components/ui/skeleton"
import { useAmbientes, useProjeto } from "@/features/projects/hooks"

import { ProjetoComErro } from "./ProjetoComErro"

function CabecalhoSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-80 max-w-full" />
        </div>
    )
}

function AmbientesSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
        </div>
    )
}

/**
 * Duas regioes. Os ambientes sao a `principal`: e o conteudo da aba, e o que
 * decide `load_ms` e `is_empty`. O vazio dos ambientes renderiza o proprio
 * workspace com lista vazia, porque o estado vazio dele tem o botao de
 * adicionar — mesma paridade da tela antiga.
 *
 * O objeto do projeto nunca e "vazio" (`vazioPorPadrao` so chuta array e
 * pagina), entao o `empty` do cabecalho nao e alcancavel e fica `null`.
 */
export function ProjetoContent({ id }: { id: string }) {
    const projeto = useProjeto(id)
    const ambientes = useAmbientes(id)

    return (
        <div className="flex h-full flex-col space-y-6 p-4 md:p-8">
            <div data-testid="projeto-cabecalho">
                <QueryBoundary
                    query={projeto}
                    skeleton={<CabecalhoSkeleton />}
                    empty={null}
                    error={(erro, refazer) => <ProjetoComErro erro={erro} refazer={refazer} />}
                >
                    {(dados) => <ProjectHeader project={dados} activeTab="ambientes" />}
                </QueryBoundary>
            </div>

            <div data-testid="projeto-ambientes" className="mt-6 flex-1">
                {/* Regiao `principal` (decide load_ms/is_empty da tela) — por
                    isso o erro dela usa o testid especifico
                    "projeto-ambientes-error", nunca o "projeto-error" do
                    cabecalho: os dois QueryBoundary sao independentes e podem
                    errar ao mesmo tempo. */}
                <QueryBoundary
                    query={ambientes}
                    principal
                    skeleton={<AmbientesSkeleton />}
                    empty={<EnvironmentsWorkspace projectId={id} ambientes={[]} />}
                    error={(erro, refazer) => (
                        <ProjetoComErro erro={erro} refazer={refazer} testId="projeto-ambientes-error" />
                    )}
                >
                    {(lista) => <EnvironmentsWorkspace projectId={id} ambientes={lista} />}
                </QueryBoundary>
            </div>
        </div>
    )
}
