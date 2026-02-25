import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EnvironmentsWorkspace } from "@/components/projects/environments/EnvironmentsWorkspace"
import { EditProjectButton } from "@/components/projects/EditProjectButton"
import { DeleteProjectAlert } from "@/components/projects/DeleteProjectAlert"
import { ProjectStatusSelect } from "@/components/projects/ProjectStatusSelect"

async function getProjectDetails(id: string) {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    if (!token) return null

    try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
        const res = await fetch(`${apiBase}/api/projects/${id}`, {
            headers: { "Authorization": `Bearer ${token}` },
            cache: 'no-store'
        })
        if (!res.ok) return null
        return res.json()
    } catch (e) {
        return null
    }
}

async function getProjectEnvironments(id: string) {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    if (!token) return []

    try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
        const res = await fetch(`${apiBase}/api/projects/${id}/environments`, {
            headers: { "Authorization": `Bearer ${token}` },
            cache: 'no-store'
        })
        if (!res.ok) return []
        return res.json()
    } catch (e) {
        return []
    }
}

export default async function ProjectWorkspacePage(
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params
    const project = await getProjectDetails(params.id)

    if (!project) {
        notFound()
    }

    const environments = await getProjectEnvironments(params.id)

    return (
        <div className="h-full flex flex-col space-y-6 p-8">
            {/* Header */}
            <div className="flex flex-col space-y-4">
                <Button variant="ghost" asChild className="w-fit -ml-4 text-muted-foreground hover:text-foreground">
                    <Link href="/projects">
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Voltar para Projetos
                    </Link>
                </Button>

                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
                        <p className="text-muted-foreground flex mb-1 items-center gap-2 flex-wrap">
                            <span>Cliente: <span className="font-medium text-foreground">{project.client?.name}</span></span>
                            <span>•</span>
                            <span>{project.service_type || "Interiores"}</span>
                        </p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <ProjectStatusSelect projectId={project.id} currentStatus={project.status} />
                        <span className="w-px h-6 bg-border mx-2 hidden md:block"></span>
                        <EditProjectButton projectData={project} />
                        <DeleteProjectAlert projectId={project.id} projectName={project.name} />
                    </div>
                </div>
            </div>

            {/* Workspace Modules */}
            <div className="flex-1 mt-6">
                <Tabs defaultValue="ambientes" className="h-full flex flex-col">
                    <TabsList className="w-fit">
                        <TabsTrigger value="ambientes">Ambientes</TabsTrigger>
                        <TabsTrigger value="orcamento" disabled>Orçamento</TabsTrigger>
                        <TabsTrigger value="apresentacao" disabled>Apresentação</TabsTrigger>
                    </TabsList>

                    <div className="flex-1 mt-6">
                        <TabsContent value="ambientes" className="m-0 h-full">
                            <EnvironmentsWorkspace projectId={project.id} initialEnvironments={environments} />
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    )
}
