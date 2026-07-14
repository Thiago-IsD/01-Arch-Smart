import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import { BuilderClient } from "./components/BuilderClient"
import { apiUrl } from "@/lib/api-url"

async function getPresentationData(presentationId: string, token: string) {
    try {
        const res = await fetch(apiUrl(`/api/presentations/${presentationId}`), {
            headers: { "Authorization": `Bearer ${token}` },
            cache: 'no-store'
        })
        if (!res.ok) return null
        return res.json()
    } catch (e) {
        return null
    }
}

async function getBudgetData(projectId: string, token: string) {
    try {
        const res = await fetch(apiUrl(`/api/projects/${projectId}/budget`), {
            headers: { "Authorization": `Bearer ${token}` },
            cache: 'no-store'
        })
        if (!res.ok) return null
        return res.json()
    } catch (e) {
        return null
    }
}

export default async function PresentationBuilderPage(
    props: { params: Promise<{ id: string, presentation_id: string }> }
) {
    const params = await props.params

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    if (!token) notFound()

    const [presentation, budgetData] = await Promise.all([
        getPresentationData(params.presentation_id, token!),
        getBudgetData(params.id, token!)
    ])

    if (!presentation || presentation.project_id !== params.id) {
        notFound()
    }

    return (
        <div className="relative">
            <BuilderClient
                projectId={params.id}
                presentationId={params.presentation_id}
                initialData={presentation}
                initialBudgetData={budgetData}
            />
        </div>
    )
}
