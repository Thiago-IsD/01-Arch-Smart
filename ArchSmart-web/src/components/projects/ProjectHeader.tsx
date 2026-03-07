import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EditProjectButton } from "@/components/projects/EditProjectButton"
import { DeleteProjectAlert } from "@/components/projects/DeleteProjectAlert"
import { ProjectStatusSelect } from "@/components/projects/ProjectStatusSelect"
import { DynamicBreadcrumb } from "@/contexts/BreadcrumbContext"

interface ProjectHeaderProps {
    project: any;
    activeTab?: "ambientes" | "orcamento" | "apresentacao";
}

export function ProjectHeader({ project, activeTab = "ambientes" }: ProjectHeaderProps) {
    if (!project) return null;

    return (
        <div className="flex flex-col space-y-4">
            <DynamicBreadcrumb segment={project.id} label={project.name} />
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

            {/* Workspace Modules Navigation */}
            <div className="flex-1 mt-6">
                <Tabs value={activeTab} className="h-full flex flex-col">
                    <TabsList className="w-fit">
                        <Link href={`/projects/${project.id}`}>
                            <TabsTrigger value="ambientes" data-state={activeTab === "ambientes" ? "active" : "inactive"}>
                                Ambientes
                            </TabsTrigger>
                        </Link>
                        <Link href={`/projects/${project.id}/budget`}>
                            <TabsTrigger value="orcamento" data-state={activeTab === "orcamento" ? "active" : "inactive"}>
                                Orçamento
                            </TabsTrigger>
                        </Link>
                        <Link href={`/projects/${project.id}/presentation`}>
                            <TabsTrigger value="apresentacao" data-state={activeTab === "apresentacao" ? "active" : "inactive"}>
                                Apresentação
                            </TabsTrigger>
                        </Link>
                    </TabsList>
                </Tabs>
            </div>
        </div>
    )
}
