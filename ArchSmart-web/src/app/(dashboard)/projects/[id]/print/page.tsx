import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import { ExternalLink } from "lucide-react"
import { apiUrl } from "@/lib/api-url"
import { PrintControls } from "./PrintControls"

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

async function getProjectBudget(id: string) {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    if (!token) return null

    try {
        const res = await fetch(apiUrl(`/api/projects/${id}/budget`), {
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
        const res = await fetch(apiUrl(`/api/projects/${id}/environments`), {
            headers: { "Authorization": `Bearer ${token}` },
            cache: 'no-store'
        })
        if (!res.ok) return []
        return res.json()
    } catch (e) {
        return []
    }
}

export default async function ProjectPrintPage(
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params
    const projectId = params.id

    const [project, budget, environments] = await Promise.all([
        getProjectDetails(projectId),
        getProjectBudget(projectId),
        getProjectEnvironments(projectId)
    ])

    if (!project || !budget) {
        notFound()
    }

    // Filter and group items by environment
    const groupedItems = environments.map((env: any) => {
        const items = (budget.items || []).filter((item: any) => item.environment_id === env.id)
        return { env, items }
    }).filter((group: any) => group.items.length > 0)

    return (
        <div className="min-h-screen bg-slate-50 print:bg-white text-slate-900 font-sans">
            {/* Controles de impressão (client component: toggle A4/A3 + print) */}
            <PrintControls projectId={projectId} />

            {/* Print Booklet Container */}
            <div className="max-w-[210mm] mx-auto bg-white p-12 my-8 shadow-md border rounded print:my-0 print:border-none print:shadow-none print:p-0">
                
                {/* Booklet Cover Header */}
                <div className="border-b pb-8 mb-12 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-800 uppercase">Especificação Técnica</h1>
                        <p className="text-lg text-slate-500 font-medium mt-1">Caderno de Obras e Materiais</p>
                    </div>
                    <div className="text-right">
                        <p className="font-semibold text-lg text-primary">{project.name}</p>
                        <p className="text-sm text-slate-500">Cliente: <span className="font-medium text-slate-700">{project.client?.name}</span></p>
                        <p className="text-xs text-slate-400 mt-1">{new Date().toLocaleDateString('pt-BR')}</p>
                    </div>
                </div>

                {/* Table of Contents / Intro */}
                <div className="mb-10 text-sm text-slate-600 bg-slate-50 p-6 rounded-lg border border-slate-100 print:bg-white print:border-slate-200">
                    <p className="font-semibold text-slate-800 mb-2">Orientações de Obra:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Todas as dimensões devem ser confirmadas in loco antes da fabricação ou compra.</li>
                        <li>Os fatores de perda calculados para revestimentos são estimados em 10%.</li>
                        <li>Dúvidas ou divergências nas especificações devem ser reportadas imediatamente ao arquiteto.</li>
                    </ul>
                </div>

                {/* environments Loop */}
                {groupedItems.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 border border-dashed rounded-lg">
                        Nenhum material especificado nos ambientes deste projeto.
                    </div>
                ) : (
                    <div className="space-y-12">
                        {groupedItems.map(({ env, items }: any) => (
                            <div key={env.id} className="break-inside-avoid-page space-y-4 pt-4 first:pt-0">
                                <div className="border-b border-slate-300 pb-2 mb-4">
                                    <h2 className="text-xl font-bold tracking-tight text-slate-800 uppercase flex items-center justify-between">
                                        <span>{env.name}</span>
                                        <span className="text-xs text-slate-400 font-medium">{env.type || "Geral"}</span>
                                    </h2>
                                </div>

                                {/* Items Grid */}
                                <div className="divide-y divide-slate-200 border-t border-b">
                                    {items.map((item: any) => {
                                        const activeOption = item.options.find((o: any) => o.is_selected) || item.options[0]
                                        if (!activeOption || !activeOption.product) return null
                                        const product = activeOption.product
                                        const qty = item.rule_type === "UNIT" ? (item.manual_quantity || 1) : (item.calculated_quantity || 0)

                                        return (
                                            <div key={item.id} className="py-4 flex gap-6 items-start break-inside-avoid">
                                                {/* Product Image */}
                                                <div className="w-24 h-24 bg-slate-50 border rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                                                    {product.image_url ? (
                                                        <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase">Sem foto</span>
                                                    )}
                                                </div>

                                                {/* Product Details */}
                                                <div className="flex-1 space-y-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="font-bold text-base text-slate-900 leading-tight truncate">{product.name}</h4>
                                                        <span className="text-xs font-bold text-slate-500 uppercase px-2 py-0.5 bg-slate-100 rounded border">
                                                            {product.category || "Geral"}
                                                        </span>
                                                    </div>
                                                    
                                                    {product.store && (
                                                        <p className="text-xs text-slate-500">Marca / Fornecedor: <span className="font-medium text-slate-700">{product.store}</span></p>
                                                    )}

                                                    {/* Dimensions */}
                                                    {product.dimensions && (product.dimensions.width || product.dimensions.height || product.dimensions.depth) ? (
                                                        <p className="text-xs text-slate-500">
                                                            Dimensões:{" "}
                                                            <span className="font-medium text-slate-700">
                                                                {[
                                                                    product.dimensions.width && `${product.dimensions.width}L`,
                                                                    product.dimensions.height && `${product.dimensions.height}A`,
                                                                    product.dimensions.depth && `${product.dimensions.depth}P`
                                                                ].filter(Boolean).join(" x ")} cm
                                                            </span>
                                                        </p>
                                                    ) : null}

                                                    {product.description && (
                                                        <p className="text-xs text-slate-600 italic mt-1 line-clamp-2 leading-relaxed">{product.description}</p>
                                                    )}

                                                    {product.source_url && (
                                                        <p className="text-xs text-slate-500 flex items-center gap-1 pt-0.5">
                                                            <ExternalLink className="w-3 h-3 shrink-0" />
                                                            <a
                                                                href={product.source_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-primary underline underline-offset-2 break-all print:text-slate-700 print:no-underline"
                                                            >
                                                                {product.source_url}
                                                            </a>
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Quantities & Values */}
                                                <div className="text-right flex-shrink-0 space-y-1 w-32">
                                                    <p className="text-xs text-slate-400">Quantidade</p>
                                                    <p className="font-bold text-base text-slate-800">
                                                        {qty % 1 === 0 ? qty : qty.toFixed(2)} un
                                                    </p>
                                                    <p className="text-xs text-slate-400">Preço Unitário</p>
                                                    <p className="font-semibold text-xs text-slate-700">
                                                        R$ {(product.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400">Subtotal</p>
                                                    <p className="font-bold text-sm text-primary">
                                                        R$ {(qty * (product.price || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Footer disclaimer */}
                <div className="border-t pt-8 mt-12 text-center text-[10px] text-slate-400 print:mt-24">
                    <p>Documento gerado eletronicamente pela plataforma Arch Smart.</p>
                </div>
            </div>
            
            {/* Custom print Styles (o tamanho de página @page é controlado pelo PrintControls) */}
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    body {
                        background-color: white !important;
                    }
                    .break-inside-avoid {
                        break-inside: avoid;
                    }
                    .break-inside-avoid-page {
                        break-inside: avoid-page;
                    }
                }
            `}} />
        </div>
    )
}
