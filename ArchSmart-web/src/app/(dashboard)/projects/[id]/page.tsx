import { Suspense } from "react"

import { ProjectWorkspaceSkeleton } from "@/components/projects/ProjectWorkspaceSkeleton"

import { ProjetoData } from "./components/ProjetoData"

export default async function ProjectWorkspacePage(props: { params: Promise<{ id: string }> }) {
    const { id } = await props.params

    return (
        <Suspense
            fallback={
                <div data-testid="projeto-shell-streaming">
                    <ProjectWorkspaceSkeleton />
                </div>
            }
        >
            <ProjetoData id={id} />
        </Suspense>
    )
}
