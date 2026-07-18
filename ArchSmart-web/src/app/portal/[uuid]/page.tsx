import type { Metadata } from "next"
import { PortalClient } from "./components/PortalClient"

// Busca leve só para o <title>/description. Sem token, o backend responde com
// nome + branding mesmo quando protegida (o conteúdo continua bloqueado).
async function fetchMeta(uuid: string): Promise<any | null> {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    try {
        const res = await fetch(`${baseUrl}/public/presentations/${uuid}`, { cache: "no-store" })
        if (!res.ok) return null
        return await res.json()
    } catch {
        return null
    }
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ uuid: string }>
}): Promise<Metadata> {
    const { uuid } = await params
    const data = await fetchMeta(uuid)
    return {
        title: data ? `${data.name} | ${data.branding?.office_name || "Arch Smart"}` : "Apresentação | Arch Smart",
        description: data?.description || "Visualize sua apresentação de projeto.",
    }
}

// O portal é renderizado no cliente: ele lê o token do localStorage, mostra o
// portão de senha quando necessário e só então busca o conteúdo protegido.
export default async function PortalPage({
    params,
}: {
    params: Promise<{ uuid: string }>
}) {
    const { uuid } = await params
    return <PortalClient uuid={uuid} />
}
