import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import { SidebarNav } from "@/app/(dashboard)/projects/[id]/budget/components/SidebarNav"
import { MainBudgetArea } from "@/app/(dashboard)/projects/[id]/budget/components/MainBudgetArea"
import { ProjectHeader } from "@/components/projects/ProjectHeader"
import { Tabs, TabsContent } from "@/components/ui/tabs"
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

async function getProjectBudget(id: string) {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    if (!token) return null

    try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
        // Force endpoint to create empty budget block if none exists
        const res = await fetch(`${apiBase}/api/projects/${id}/budget`, {
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

export default async function BudgetWorkspacePage(
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params
    const projectId = params.id

    // Server requests in parallel
    const [budgetTree, environments, project] = await Promise.all([
        getProjectBudget(projectId),
        getProjectEnvironments(projectId),
        getProjectDetails(projectId)
    ])

    if (!budgetTree) {
        notFound() // Failsafe if not even a placeholder was created
    }

    return (
        <div className="h-full flex flex-col space-y-6 p-8">
            {project && <ProjectHeader project={project} activeTab="orcamento" />}

            {/* Workspace Modules */}
            <div className="flex-1 mt-6">
                <Tabs defaultValue="orcamento" className="h-full flex flex-col">
                    <div className="flex-1 mt-6">
                        <TabsContent value="orcamento" className="m-0 flex-1 flex flex-col h-[70vh] w-full border rounded-lg overflow-hidden bg-background">
                            {/* The Main Area wrapper will split to Sidebar / Center and hold Context */}
                            <MainBudgetArea projectId={projectId} budgetTree={budgetTree} environments={environments} projectName={project?.name} />
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    )
}
