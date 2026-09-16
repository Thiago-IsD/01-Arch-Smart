import { Suspense } from "react"

import { ClientWizardDriver } from "./ClientWizardDriver"
import { ProjetosData } from "./components/ProjetosData"
import { ProjetosSkeleton } from "./components/ProjetosSkeleton"

/**
 * Server Component. O fallback e o SERVIDOR fazendo stream; o skeleton do
 * QueryBoundary, dentro de ProjetosContent, e o CLIENTE carregando — por isso
 * o testid do wrapper e outro (ver dashboard/page.tsx).
 *
 * O wizard continua dirigido por `?action=new` e fica FORA do Suspense: abrir o
 * dialogo nao espera a lista.
 */
export default async function ProjectsPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const searchParams = await props.searchParams

    return (
        <>
            <Suspense
                fallback={
                    <div data-testid="projetos-shell-streaming" className="p-4 md:p-8">
                        <ProjetosSkeleton />
                    </div>
                }
            >
                <ProjetosData />
            </Suspense>
            <ClientWizardDriver isOpen={searchParams.action === "new"} />
        </>
    )
}
