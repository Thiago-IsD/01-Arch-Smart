"use client"

import React, { useState, useEffect } from "react"
import { Navbar } from "@/components/landing/Navbar"
import Footer from "@/components/landing/Footer"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    ScanLine,
    Ruler,
    Calculator,
    CheckCircle2,
    Sparkles,
    MousePointer2,
    AlertCircle,
    Smartphone,
    ArrowRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

// --- Components for Abstract UI ---

const AbstractWindow = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <div className={cn("overflow-hidden rounded-xl border bg-background shadow-2xl", className)}>
        <div className="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-3">
            <div className="h-2.5 w-2.5 rounded-full bg-destructive" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
        </div>
        <div className="p-4 md:p-6">{children}</div>
    </div>
)

const MetricBadge = ({ label, value }: { label: string, value: string }) => (
    <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/30 p-2 text-center text-xs">
        <span className="mb-1 text-muted-foreground">{label}</span>
        <span className="font-mono font-bold text-foreground">{value}</span>
    </div>
)

// --- Page Sections ---

export default function ProductPage() {
    const [activeTab, setActiveTab] = useState("curadoria")

    // Simple scroll spy logic
    useEffect(() => {
        const handleScroll = () => {
            const sections = ["curadoria", "dna", "orcamento", "portal"]
            for (const section of sections) {
                const element = document.getElementById(section)
                if (element) {
                    const rect = element.getBoundingClientRect()
                    if (rect.top >= 0 && rect.top <= 300) {
                        setActiveTab(section)
                        break
                    }
                }
            }
        }
        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    const scrollTo = (id: string) => {
        const element = document.getElementById(id)
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" })
            setActiveTab(id)
        }
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />

            {/* 1. Hero Section */}
            <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
                <div className="container relative z-10 px-4 md:px-6 text-center">
                    <Badge variant="outline" className="mb-4 border-primary/20 bg-primary/5 text-primary">
                        A Arquitetura do Futuro
                    </Badge>
                    <h1 className="mx-auto mb-6 max-w-4xl text-4xl font-bold tracking-tight lg:text-5xl xl:text-6xl text-balance">
                        Um fluxo. Quatro núcleos. <br />
                        <span className="text-primary">Controle total.</span>
                    </h1>
                    <p className="mx-auto mb-10 max-w-2xl text-xl text-muted-foreground text-balance">
                        Do Web Clipper ao Aceite do Cliente, o Arch Smart conecta a lógica técnica à visual de forma fluida.
                    </p>

                    {/* Visual Abstract Connection */}
                    <div className="mx-auto flex max-w-3xl items-center justify-center gap-4 md:gap-8 opacity-80">
                        <div className="flex flex-col items-center gap-2">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <ScanLine size={24} />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">Biblioteca</span>
                        </div>
                        <div className="h-px w-8 bg-gradient-to-r from-transparent via-border to-transparent md:w-24" />
                        <div className="flex flex-col items-center gap-2">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <Ruler size={24} />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">Projeto</span>
                        </div>
                        <div className="h-px w-8 bg-gradient-to-r from-transparent via-border to-transparent md:w-24" />
                        <div className="flex flex-col items-center gap-2">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <Calculator size={24} />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">Orçamento</span>
                        </div>
                        <div className="h-px w-8 bg-gradient-to-r from-transparent via-border to-transparent md:w-24" />
                        <div className="flex flex-col items-center gap-2">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <div className="relative">
                                    <MousePointer2 size={24} />
                                    <div className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary animate-pulse" />
                                </div>
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">Portal</span>
                        </div>
                    </div>
                </div>

                {/* Decorative Grid Background */}
                <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
            </section>

            {/* 2. Sticky Navigation REMOVED per user request */}

            <main className="flex-1">

                {/* Core 1: Biblioteca & Curadoria */}
                <section id="curadoria" className="py-24 scroll-mt-28">
                    <div className="container px-4 md:px-6">
                        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
                            <div className="order-2 lg:order-1 relative">
                                {/* Abstract UI: Web Clipper */}
                                <AbstractWindow className="max-w-[500px] mx-auto lg:ml-0 bg-transparent border-dashed">
                                    {/* Simulated Browser Page Content */}
                                    <div className="absolute -z-10 bg-gradient-to-br from-primary/5 to-transparent inset-0 opacity-50 blur-3xl" />

                                    <div className="relative mb-6 rounded-lg border bg-card p-4 shadow-sm opacity-60 scale-95 origin-bottom">
                                        <div className="h-32 w-full rounded-md bg-muted/50 animate-pulse mb-3" />
                                        <div className="h-4 w-2/3 rounded bg-muted/50 mb-2" />
                                        <div className="h-4 w-1/3 rounded bg-muted/50" />
                                    </div>

                                    {/* The Clipper Overlay */}
                                    <div className="relative z-10 -mt-12 ml-8 rounded-lg border bg-background p-4 shadow-xl ring-1 ring-border">
                                        <div className="mb-3 flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                                                <Sparkles className="h-4 w-4" />
                                                Arch Smart AI
                                            </div>
                                            <Badge variant="secondary" className="text-[10px] h-5">Web Clipper</Badge>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex gap-3">
                                                <div className="h-16 w-16 shrink-0 rounded bg-muted">
                                                    {/* Placeholder for Product Image */}
                                                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                                        <ScanLine size={20} />
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5 flex-1">
                                                    <div className="h-2 w-full rounded bg-primary/20" />
                                                    <div className="h-2 w-3/4 rounded bg-primary/10" />
                                                    <div className="flex gap-2 pt-1">
                                                        <div className="h-5 w-12 rounded bg-primary/20 border border-primary/30" />
                                                        <div className="h-5 w-5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="rounded bg-muted/30 p-2 space-y-2">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-muted-foreground">Preço detectado:</span>
                                                    <span className="font-mono font-bold">R$ 1.250,90</span>
                                                </div>
                                                <div className="h-px bg-border" />
                                                <div className="flex justify-between text-xs items-center">
                                                    <span className="text-muted-foreground">Normalização IA:</span>
                                                    <Badge variant="outline" className="text-[10px] border-primary text-primary gap-1 pl-1">
                                                        <CheckCircle2 size={8} /> Completo
                                                    </Badge>
                                                </div>
                                            </div>
                                            <Button size="sm" className="w-full h-8 text-xs">
                                                Adicionar à Biblioteca
                                            </Button>
                                        </div>
                                    </div>
                                </AbstractWindow>
                            </div>

                            <div className="order-1 lg:order-2 space-y-4">
                                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <ScanLine size={20} />
                                </div>
                                <h2 className="text-3xl font-bold tracking-tight md:text-4xl">A internet é o seu catálogo.</h2>
                                <p className="text-lg text-muted-foreground leading-relaxed">
                                    Esqueça o copia-e-cola manual. Com o Web Clipper do Arch Smart, você captura produtos de qualquer site e nossa IA normaliza automaticamente as especificações técnicas, preços e imagens.
                                </p>
                                <ul className="space-y-2 text-muted-foreground mt-4">
                                    <li className="flex items-center gap-2"><CheckCircle2 className="text-primary h-4 w-4" /> Preenchimento automático de campos</li>
                                    <li className="flex items-center gap-2"><CheckCircle2 className="text-primary h-4 w-4" /> Padronização de unidades e categorias</li>
                                    <li className="flex items-center gap-2"><CheckCircle2 className="text-primary h-4 w-4" /> Histórico de preços e versões</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="container px-4"><div className="h-px bg-border" /></div>

                {/* Core 2: Projeto & Ambientes */}
                <section id="dna" className="py-24 scroll-mt-28 bg-muted/20">
                    <div className="container px-4 md:px-6">
                        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
                            <div className="space-y-4">
                                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <Ruler size={20} />
                                </div>
                                <h2 className="text-3xl font-bold tracking-tight md:text-4xl">O fim do levantamento manual.</h2>
                                <p className="text-lg text-muted-foreground leading-relaxed">
                                    Defina o "DNA" do ambiente uma única vez. O sistema utiliza essas variáveis para calcular quantitativos de todos os materiais automaticamente, eliminando erros de cálculo.
                                </p>
                                <div className="mt-6 flex flex-wrap gap-2">
                                    <Badge variant="secondary" className="px-3 py-1">Sem planilhas auxiliares</Badge>
                                    <Badge variant="secondary" className="px-3 py-1">Precisão decimal</Badge>
                                </div>
                            </div>

                            <div className="relative">
                                <AbstractWindow className="max-w-[450px] mx-auto">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="font-semibold text-lg flex items-center gap-2">
                                            <div className="w-2 h-6 bg-primary rounded-full" />
                                            Sala de Estar
                                        </h3>
                                        <Badge variant="outline">DNA Configurável</Badge>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <MetricBadge label="Piso" value="45 m²" />
                                        <MetricBadge label="Teto" value="45 m²" />
                                        <MetricBadge label="Pé direito" value="2.80 m" />
                                        <MetricBadge label="Paredes" value="126 m²" />
                                        <MetricBadge label="Rodapé" value="38 m" />
                                        <MetricBadge label="Aberturas" value="12 m²" />
                                    </div>

                                    <div className="mt-6 rounded-lg border border-dashed p-3 bg-muted/20">
                                        <div className="text-xs font-semibold text-primary mb-2 flex items-center gap-1">
                                            <Calculator size={12} />
                                            Cálculo Automático de Tinta
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Área Real de Pintura:</span>
                                            <span className="font-mono">114 m²</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                                            <span>(Paredes - Aberturas)</span>
                                        </div>
                                    </div>
                                </AbstractWindow>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="container px-4"><div className="h-px bg-border" /></div>

                {/* Core 3: Orçamento Inteligente */}
                <section id="orcamento" className="py-24 scroll-mt-28">
                    <div className="container px-4 md:px-6">
                        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
                            <div className="order-2 lg:order-1 relative">
                                <AbstractWindow className="max-w-[550px] mx-auto">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-medium text-sm">Comparativo de Materiais</h4>
                                            <Badge>High vs Low</Badge>
                                        </div>

                                        {/* Comparative Grid */}
                                        <div className="grid grid-cols-12 gap-2 text-sm border-b pb-2">
                                            <div className="col-span-4 font-medium text-muted-foreground">Item</div>
                                            <div className="col-span-4 font-medium text-muted-foreground text-center">Opção A</div>
                                            <div className="col-span-4 font-medium text-muted-foreground text-right">Opção B</div>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Row 1 */}
                                            <div className="grid grid-cols-12 gap-2 items-center">
                                                <div className="col-span-4 font-medium">Piso Geral</div>
                                                <div className="col-span-4 text-center">
                                                    <div className="font-bold">R$ 5.400</div>
                                                    <div className="text-[10px] text-muted-foreground">Porcelanato 90x90</div>
                                                </div>
                                                <div className="col-span-4 text-right">
                                                    <div className="font-bold text-primary">R$ 3.800</div>
                                                    <div className="text-[10px] text-muted-foreground">Vinílico SPC</div>
                                                </div>
                                            </div>

                                            {/* Row 2 - Focused Calculation */}
                                            <div className="relative rounded-lg bg-muted/40 p-3 ring-1 ring-primary/20">
                                                <div className="absolute -top-2 left-3 bg-background px-2 text-[10px] font-bold text-primary">
                                                    Memória de Cálculo
                                                </div>
                                                <div className="flex items-center justify-between gap-2 text-xs font-mono text-muted-foreground">
                                                    <span>(DNA: 45m²)</span>
                                                    <span>×</span>
                                                    <span>(Preço + 10% Quebra)</span>
                                                    <span>=</span>
                                                    <span className="font-bold text-foreground">Total</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </AbstractWindow>
                            </div>

                            <div className="order-1 lg:order-2 space-y-4">
                                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <Calculator size={20} />
                                </div>
                                <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Orçamentos que se calculam sozinhos.</h2>
                                <p className="text-lg text-muted-foreground leading-relaxed">
                                    Crie múltiplos cenários de custo (High/Low) instantaneamente. O sistema cruza os dados do DNA do ambiente com os preços da biblioteca, aplicando automaticamente margens de perda e custos de instalação.
                                </p>
                                <ul className="space-y-2 text-muted-foreground mt-4">
                                    <li className="flex items-center gap-2"><CheckCircle2 className="text-primary h-4 w-4" /> Comparativos lado a lado</li>
                                    <li className="flex items-center gap-2"><CheckCircle2 className="text-primary h-4 w-4" /> Atualização de preços em lote</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="container px-4"><div className="h-px bg-border" /></div>

                {/* Core 4: Portal do Cliente */}
                <section id="portal" className="py-24 scroll-mt-28 bg-muted/20">
                    <div className="container px-4 md:px-6">
                        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
                            <div className="space-y-4">
                                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <MousePointer2 size={20} />
                                </div>
                                <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Apresentações vivas.</h2>
                                <p className="text-lg text-muted-foreground leading-relaxed">
                                    Chega de PDFs estáticos que ficam desatualizados no minuto seguinte. Seu cliente acessa um link exclusivo para visualizar produtos, valores e cronogramas, podendo aprovar ou solicitar ajustes em tempo real.
                                </p>
                                <ul className="space-y-2 text-muted-foreground mt-4">
                                    <li className="flex items-center gap-2"><CheckCircle2 className="text-primary h-4 w-4" /> Aceite digital jurídico</li>
                                    <li className="flex items-center gap-2"><CheckCircle2 className="text-primary h-4 w-4" /> Comentários por item</li>
                                    <li className="flex items-center gap-2"><CheckCircle2 className="text-primary h-4 w-4" /> Acesso mobile-first</li>
                                </ul>
                            </div>

                            <div className="relative">
                                {/* Mobile Device Simulation */}
                                <div className="relative mx-auto h-[500px] w-[280px] rounded-[2.5rem] border-[8px] border-foreground/10 bg-black shadow-2xl">
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 h-4 w-24 bg-black rounded-b-xl z-20" />

                                    <div className="h-full w-full bg-background rounded-[2rem] overflow-hidden flex flex-col">
                                        {/* App Header */}
                                        <div className="bg-background border-b p-4 pt-8 text-center font-semibold">
                                            Resumo do Projeto
                                        </div>

                                        {/* App Content */}
                                        <div className="flex-1 p-4 space-y-4 overflow-hidden relative">
                                            {/* Scroll fade overlay */}
                                            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent z-10" />

                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded bg-muted animate-pulse" />
                                                    <div className="flex-1 space-y-1">
                                                        <div className="h-3 w-2/3 rounded bg-muted" />
                                                        <div className="h-2 w-1/3 rounded bg-muted" />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded bg-muted animate-pulse" />
                                                    <div className="flex-1 space-y-1">
                                                        <div className="h-3 w-3/4 rounded bg-muted" />
                                                        <div className="h-2 w-1/2 rounded bg-muted" />
                                                    </div>
                                                </div>

                                                <div className="mt-8 rounded-lg bg-primary/5 p-4 text-center">
                                                    <div className="text-xs text-muted-foreground">Total da Etapa</div>
                                                    <div className="text-2xl font-bold tracking-tight text-primary">R$ 45.240</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Floating Actions */}
                                        <div className="p-4 bg-background border-t space-y-3 relative z-20">
                                            <Button className="w-full h-11 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/10">
                                                Aprovar Orçamento
                                            </Button>
                                            <Button variant="outline" className="w-full h-11 border-dashed">
                                                Solicitar Revisão
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Floating Notification Abstract */}
                                <div className="absolute top-12 -right-4 lg:-right-12 bg-background border rounded-lg p-3 shadow-xl animate-bounce duration-[2000ms]">
                                    <div className="flex items-center gap-2 text-xs font-semibold">
                                        <div className="h-2 w-2 rounded-full bg-primary" />
                                        Cliente visualizando agora
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 7. CTA Final */}
                <section className="py-24 bg-primary text-primary-foreground text-center">
                    <div className="container px-4">
                        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
                            Pronto para profissionalizar sua gestão?
                        </h2>
                        <p className="text-primary-foreground/80 max-w-2xl mx-auto mb-10 text-lg">
                            Junte-se à lista de espera e seja um dos primeiros a experimentar o fluxo que vai transformar seu escritório.
                        </p>
                        <Button size="lg" variant="secondary" className="px-8 h-12 text-base shadow-xl" asChild>
                            <Link href="/auth/register">
                                Entrar na Lista de Espera <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                </section>

            </main>
            <Footer />
        </div>
    )
}
