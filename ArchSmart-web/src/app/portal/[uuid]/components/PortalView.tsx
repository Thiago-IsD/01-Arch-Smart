"use client"

import { MapPin, Building2 } from "lucide-react"
import { PortalBudget } from "./PortalBudget"
import { EnvironmentGallery } from "./EnvironmentGallery"
import { PresentationTimeline } from "./PresentationTimeline"

// ======= Types =======

export interface PublicProductInfo {
    id: string
    name: string
    store: string | null
    price: number | null
    image_url: string | null
    source_url: string | null
}

export interface PublicOptionInfo {
    id: string
    is_selected: boolean
    approval_status?: string
    rejection_reason?: string | null
    product: PublicProductInfo | null
}

export interface PublicBudgetItemInfo {
    id: string
    environment_id: string | null
    rule_type: string
    calculated_quantity: number | null
    manual_quantity: number | null
    options: PublicOptionInfo[]
}

export interface PublicEnvironmentInfo {
    id: string
    environment_id: string
    environment_name: string
    title: string | null
    subtitle: string | null
    description: string | null
    image_urls: string[]
}

export interface PublicBrandingInfo {
    office_name: string | null
    logo_url: string | null
    cover_url: string | null
}

export interface PublicPresentationData {
    id: string
    name: string
    description: string | null
    status: string
    branding: PublicBrandingInfo
    environments: PublicEnvironmentInfo[]
    budget_items: PublicBudgetItemInfo[]
    locked?: boolean
    has_password?: boolean
}

// ======= Sub-components =======

function PortalHeader({ branding }: { branding: PublicBrandingInfo }) {
    return (
        <header className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
            <div className="max-w-3xl mx-auto px-5 py-3 flex items-center gap-3">
                {branding.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={branding.logo_url}
                        alt={branding.office_name || "Logo"}
                        className="h-9 w-auto object-contain"
                    />
                ) : (
                    <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-white" />
                    </div>
                )}
                <div>
                    <p className="text-sm font-semibold text-slate-800 leading-tight">
                        {branding.office_name || "Arch Smart"}
                    </p>
                    <p className="text-xs text-slate-500">Apresentação de Projeto</p>
                </div>
            </div>
        </header>
    )
}

function HeroSection({
    name,
    description,
    coverUrl,
}: {
    name: string
    description: string | null
    coverUrl: string | null
}) {
    return (
        <section className="relative">
            {coverUrl ? (
                <div className="relative w-full h-64 md:h-80 overflow-hidden bg-slate-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={coverUrl}
                        alt={name}
                        className="w-full h-full object-cover opacity-80"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                        <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-md leading-tight">
                            {name}
                        </h1>
                        {description && (
                            <p className="mt-2 text-sm text-white/80 line-clamp-2">{description}</p>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-gradient-to-br from-emerald-700 to-teal-800 px-6 py-10 md:py-14 text-center">
                    <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">{name}</h1>
                    {description && (
                        <p className="mt-3 text-sm text-white/80 max-w-xl mx-auto">{description}</p>
                    )}
                </div>
            )}
        </section>
    )
}

function EnvironmentSection({ env }: { env: PublicEnvironmentInfo }) {
    const title = env.title || env.environment_name
    const images = env.image_urls || []

    return (
        <section className="border-b border-slate-100 py-8">
            <div className="mb-5">
                <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span className="text-xs font-semibold text-emerald-600 uppercase tracking-widest">
                        {env.environment_name}
                    </span>
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">{title}</h2>
                {env.subtitle && (
                    <p className="mt-1 text-base text-slate-500 font-medium">{env.subtitle}</p>
                )}
            </div>

            {env.description && (
                <p className="text-sm text-slate-600 leading-relaxed mb-6 whitespace-pre-line">
                    {env.description}
                </p>
            )}

            <EnvironmentGallery
                images={images}
                title={title}
                environmentName={env.environment_name}
            />
        </section>
    )
}

// ======= Main view =======

export function PortalView({ data }: { data: PublicPresentationData }) {
    return (
        <div className="min-h-screen bg-slate-50">
            <PortalHeader branding={data.branding} />

            <HeroSection
                name={data.name}
                description={data.description}
                coverUrl={data.branding.cover_url}
            />

            <main className="max-w-3xl mx-auto px-5">
                {data.environments.length > 0 ? (
                    <div className="mt-8">
                        {data.environments.map(env => (
                            <EnvironmentSection key={env.id} env={env} />
                        ))}
                    </div>
                ) : (
                    <div className="py-12 text-center text-slate-400 text-sm">
                        Nenhum ambiente disponível nesta apresentação.
                    </div>
                )}

                <PortalBudget
                    initialItems={data.budget_items}
                    environments={data.environments}
                    presentationId={data.id}
                    status={data.status}
                />

                <PresentationTimeline presentationId={data.id} />
            </main>

            <footer className="border-t border-slate-200 py-6 text-center">
                <p className="text-xs text-slate-400">
                    Apresentação gerada por{" "}
                    <span className="font-semibold text-emerald-600">Arch Smart</span>
                    {data.branding.office_name && ` · ${data.branding.office_name}`}
                </p>
            </footer>
        </div>
    )
}
