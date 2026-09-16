"use client"

import { ProjectCard } from "@/components/projects/ProjectCard"
import { QueryBoundary } from "@/components/ui/query-boundary"
import { useListaDeProjetos } from "@/features/projects/hooks"
import type { PaginaDeProjetos } from "@/features/projects/types"

import { CabecalhoDeProjetos } from "./CabecalhoDeProjetos"
import { ProjetosComErro } from "./ProjetosComErro"
import { ProjetosSkeleton } from "./ProjetosSkeleton"
import { ProjetosVazio } from "./ProjetosVazio"

function Lista({ pagina, planLimit }: { pagina: PaginaDeProjetos; planLimit?: number }) {
    return (
        <div data-testid="projetos-pagina" className="flex flex-col gap-6">
            <CabecalhoDeProjetos ativos={pagina.active_count} planLimit={planLimit} />
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {pagina.items.map((projeto) => (
                    <ProjectCard
                        key={projeto.id}
                        id={projeto.id}
                        name={projeto.name}
                        clientName={projeto.client?.name}
                        status={projeto.status}
                        serviceType={projeto.service_type ?? undefined}
                        createdAt={projeto.created_at}
                        environmentsCount={projeto.environments_count}
                    />
                ))}
            </div>
        </div>
    )
}

/**
 * Uma requisicao, uma regiao `principal`. O vazio padrao do `QueryBoundary`
 * ja reconhece pagina (`items` vazio), entao `isEmpty` nao e passado.
 * O vazio leva o cabecalho junto: quem nao tem projeto precisa do botao.
 */
export function ProjetosContent({ planLimit }: { planLimit?: number }) {
    const query = useListaDeProjetos()

    return (
        <div className="flex h-full flex-col p-4 md:p-8">
            <QueryBoundary
                query={query}
                principal
                skeleton={<ProjetosSkeleton />}
                empty={
                    <>
                        <CabecalhoDeProjetos ativos={query.data?.active_count ?? 0} planLimit={planLimit} />
                        <ProjetosVazio />
                    </>
                }
                error={(erro, refazer) => <ProjetosComErro erro={erro} refazer={refazer} />}
            >
                {(pagina) => <Lista pagina={pagina} planLimit={planLimit} />}
            </QueryBoundary>
        </div>
    )
}
