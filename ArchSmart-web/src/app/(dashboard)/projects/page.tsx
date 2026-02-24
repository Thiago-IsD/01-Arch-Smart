import { ProjectCard } from "@/components/projects/ProjectCard"
import { ProjectWizard } from "@/components/projects/ProjectWizard"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/utils/supabase/server"

// Function to fetch projects
async function getProjects(page = 1, size = 20) {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    try {
        const res = await fetch(`http://127.0.0.1:8000/api/projects?page=${page}&size=${size}`, {
            cache: "no-store",
            headers: token ? {
                "Authorization": `Bearer ${token}`
            } : undefined
        })

        if (!res.ok) {
            console.error(`Fetch failed with status: ${res.status}`)
            return { items: [], total: 0 }
        }

        return res.json()
    } catch (error) {
        console.error("Connection error:", error)
        return { items: [], total: 0 }
    }
}

export default async function ProjectsPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const searchParams = await props.searchParams
    const action = typeof searchParams.action === "string" ? searchParams.action : undefined

    const data = await getProjects()
    const projects = data.items || []

    const isWizardOpen = action === "new"

    return (
        <div className="h-full flex flex-col space-y-6 p-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Projetos</h2>
                    <p className="text-muted-foreground">
                        Acompanhe seus projetos, ambientes e faturamento centralizados.
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button asChild>
                        <Link href="/projects?action=new">
                            <Plus className="mr-2 h-4 w-4" /> Novo Projeto
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex flex-col space-y-4 mt-8">
                {projects.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {projects.map((project: any) => (
                            <ProjectCard
                                key={project.id}
                                id={project.id}
                                name={project.name}
                                clientName={project.client?.name}
                                status={project.status}
                                serviceType={project.service_type}
                                createdAt={project.created_at}
                                environmentsCount={0} // To be implemented later when environments relation holds data
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-lg bg-muted/10">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                            <Plus className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Nenhum projeto ainda</h3>
                        <p className="text-muted-foreground mb-6 text-center max-w-sm">
                            Comece criando seu primeiro projeto arquitetônico e vincule o seu cliente.
                        </p>
                        <Button asChild>
                            <Link href="/projects?action=new">
                                Criar Primeiro Projeto
                            </Link>
                        </Button>
                    </div>
                )}
            </div>

            {/* Project Wizard Client Component wrapper with controlled State driven by URL */}
            <ProjectWizardWrapper isOpen={isWizardOpen} />
        </div>
    )
}

// Client wrapper to handle URL-based dialog closure gracefully
import { ClientWizardDriver } from "./ClientWizardDriver"

function ProjectWizardWrapper({ isOpen }: { isOpen: boolean }) {
    return <ClientWizardDriver isOpen={isOpen} />
}
