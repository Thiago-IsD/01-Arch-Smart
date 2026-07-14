import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import { ProjectHeader } from "@/components/projects/ProjectHeader"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { PresentationsTab } from "../components/PresentationsTab"
import { apiUrl } from "@/lib/api-url"

async function getProjectDetails(id: string) {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    if (!token) return null

    try {
        const res = await fetch(apiUrl(`/api/projects/${id}`), {
            headers: { "Authorization": `Bearer ${token}` },
            cache: 'no-store'
        })
        if (!res.ok) return null
        return res.json()
    } catch (e) {
        return null
    }
}

export default async function ProjectPresentationPage(
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params
    const project = await getProjectDetails(params.id)

    if (!project) {
        notFound()
    }

    return (
        <div className="h-full flex flex-col space-y-6 p-8">
            <ProjectHeader project={project} activeTab="apresentacao" />

            {/* Workspace Modules */}
            <div className="flex-1 mt-6">
                <Tabs defaultValue="apresentacao" className="h-full flex flex-col">
                    <div className="flex-1 mt-6">
                        <TabsContent value="apresentacao" className="m-0 h-full">
                            <PresentationsTab projectId={project.id} />
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    )
}
