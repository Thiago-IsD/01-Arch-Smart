import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EnvironmentsWorkspace } from "@/components/projects/environments/EnvironmentsWorkspace"
import { ProjectHeader } from "@/components/projects/ProjectHeader"

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
            <ProjectHeader project={project} activeTab="ambientes" />

            {/* Workspace Modules */}
            <div className="flex-1 mt-6">
                <Tabs defaultValue="ambientes" className="h-full flex flex-col">

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
