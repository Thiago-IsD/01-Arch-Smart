"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { 
    Plus,
    FolderIcon,
    Wallet,
    ArrowRight,
    TrendingUp, 
    TrendingDown, 
    Calendar, 
    Video, 
    ChevronRight, 
    Sparkles, 
    Package,
    FolderGit2,
    Store
} from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api-url"
import { createClient } from "@/utils/supabase/client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecentProject {
    id: string
    name: string
    client_name?: string
}

interface RecentProduct {
    id: string
    name: string
    image_url?: string
    price?: number
    store?: string
}

interface UpcomingEvent {
    id: string
    title: string
    start_time: string
    end_time: string
    meet_link?: string
    project_name?: string
}

interface DashboardLeanResponse {
    user_first_name: string
    recent_projects: RecentProject[]
    recent_products: RecentProduct[]
    active_projects_count: number
    plan_limit: number
    financial_balance: number
    financial_income: number
    financial_expense: number
    upcoming_events: UpcomingEvent[]
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
    const router = useRouter()
    const { toast } = useToast()

    const [data, setData] = useState<DashboardLeanResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [currentDate, setCurrentDate] = useState<string>("")

    // Set client-side current date
    useEffect(() => {
        const formatted = format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
        setCurrentDate(formatted.replace(/^\w/, (c) => c.toUpperCase()))
    }, [])

    const getGreeting = () => {
        const hr = new Date().getHours()
        if (hr < 12) return "Bom dia"
        if (hr < 18) return "Boa tarde"
        return "Boa noite"
    }

    // Buscar dados do dashboard
    useEffect(() => {
        let isMounted = true

        async function fetchDashboard() {
            setLoading(true)
            try {
                const supabase = createClient()
                console.log("Supabase client created in dashboard:", supabase)
                const { data: { session } } = await supabase.auth.getSession()
                console.log("Session in dashboard:", session)

                if (!session) {
                    console.log("No session found in dashboard, redirecting to login...")
                    router.push("/auth/login")
                    return
                }

                // Buscar dados do dashboard (que agora retorna métricas financeiras, eventos e contagem)
                const res = await fetch(apiUrl("/api/dashboard/lean"), {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${session.access_token}`,
                    },
                })

                if (!res.ok) throw new Error("Erro ao carregar os dados do dashboard")

                const dashboardData: DashboardLeanResponse = await res.json()
                if (isMounted) {
                    setData(dashboardData)
                }

            } catch (err: any) {
                if (isMounted) {
                    toast({
                        title: "Erro",
                        description: err.message || "Não foi possível carregar a tela inicial.",
                        variant: "destructive",
                    })
                }
            } finally {
                if (isMounted) setLoading(false)
            }
        }

        fetchDashboard()

        return () => {
            isMounted = false
        }
    }, [router, toast])

    const formatCurrency = (val: number) => {
        return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    }

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    if (loading) {
        return (
            <div className="flex flex-col gap-8 p-4 md:p-8 w-full max-w-7xl mx-auto" aria-busy="true" aria-label="Carregando painel">
                {/* Banner de saudação */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-primary/5 via-secondary/5 to-transparent p-6 rounded-2xl border border-primary/10">
                    <div className="space-y-2">
                        <Skeleton className="h-9 w-72" />
                        <Skeleton className="h-5 w-96 max-w-full" />
                    </div>
                    <Skeleton className="h-9 w-56 rounded-full" />
                </div>

                {/* Grid de métricas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i} className="bg-card shadow-sm relative overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-8 w-8 rounded-lg" />
                            </CardHeader>
                            <CardContent className="pt-2 space-y-2">
                                <Skeleton className="h-7 w-28" />
                                <Skeleton className="h-3 w-40" />
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Ações rápidas */}
                <div className="space-y-4">
                    <Skeleton className="h-6 w-32" />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-16 w-full rounded-md" />
                        ))}
                    </div>
                </div>

                {/* Grid de conteúdo secundário */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    {Array.from({ length: 3 }).map((_, col) => (
                        <div key={col} className="lg:col-span-1 flex flex-col gap-4">
                            <div className="flex items-center justify-between border-b pb-2">
                                <Skeleton className="h-6 w-44" />
                                <Skeleton className="h-4 w-16" />
                            </div>
                            <div className="flex flex-col gap-3">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    const userName = data?.user_first_name || "Usuário"
    const activeProjectsCount = data?.active_projects_count || 0
    const planLimit = data?.plan_limit ?? 2
    const projectPercentage = Math.min((activeProjectsCount / planLimit) * 100, 100)

    return (
        <div className="flex flex-col gap-8 p-4 md:p-8 w-full max-w-7xl mx-auto">
            
            {/* Header / Saudação Premium */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-primary/5 via-secondary/5 to-transparent p-6 rounded-2xl border border-primary/10">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        {getGreeting()}, {userName} <Sparkles className="h-6 w-6 text-secondary animate-pulse" />
                    </h1>
                    <p className="text-muted-foreground mt-1.5 text-base md:text-lg">
                        Bem-vindo(a) de volta! Veja o que está acontecendo no seu escritório hoje.
                    </p>
                </div>
                {currentDate && (
                    <div className="text-sm font-medium text-muted-foreground bg-background px-4 py-2 rounded-full border shadow-sm self-start md:self-auto">
                        {currentDate}
                    </div>
                )}
            </div>

            {/* Grid de Métricas Principais (Linha 1) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Metrica 1: Saldo */}
                <Card className="bg-card shadow-sm hover:shadow-md transition-shadow duration-300 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <span className="text-sm font-medium text-muted-foreground">Saldo Realizado</span>
                        <div className={`p-2 rounded-lg ${(data?.financial_balance ?? 0) >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30' : 'bg-red-50 text-red-600 dark:bg-red-950/30'}`}>
                            <Wallet className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <div className={`text-2xl font-bold tracking-tight ${(data?.financial_balance ?? 0) >= 0 ? 'text-foreground' : 'text-red-500'}`}>
                            {formatCurrency(data?.financial_balance ?? 0)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                            {(data?.financial_balance ?? 0) >= 0 ? (
                                <TrendingUp className="h-3 w-3 text-emerald-500" />
                            ) : (
                                <TrendingDown className="h-3 w-3 text-red-500" />
                            )}
                            Saldo acumulado geral realizado
                        </p>
                    </CardContent>
                </Card>

                {/* Metrica 2: Receitas */}
                <Card className="bg-card shadow-sm hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <span className="text-sm font-medium text-muted-foreground">Receitas deste Mês</span>
                        <div className="p-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 rounded-lg">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(data?.financial_income ?? 0)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                            Previsão + Realizado do mês
                        </p>
                    </CardContent>
                </Card>

                {/* Metrica 3: Despesas */}
                <Card className="bg-card shadow-sm hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <span className="text-sm font-medium text-muted-foreground">Despesas deste Mês</span>
                        <div className="p-2 bg-red-50 text-red-600 dark:bg-red-950/30 rounded-lg">
                            <TrendingDown className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <div className="text-2xl font-bold tracking-tight text-red-600 dark:text-red-400">
                            {formatCurrency(data?.financial_expense ?? 0)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                            Previsão + Realizado do mês
                        </p>
                    </CardContent>
                </Card>

                {/* Metrica 4: Projetos Ativos Limit Solo */}
                <Card className="bg-card shadow-sm hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-secondary" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <span className="text-sm font-medium text-muted-foreground">Projetos Ativos</span>
                        <Badge variant="secondary" className="text-[10px] font-semibold bg-secondary/10 text-secondary border-secondary/20">
                            Plano Solo
                        </Badge>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <div className="flex items-baseline justify-between mb-2">
                            <span className="text-2xl font-bold tracking-tight">{activeProjectsCount}</span>
                            <span className="text-xs text-muted-foreground">limite de {planLimit}</span>
                        </div>
                        
                        {/* Custom Progress Bar */}
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden mb-1.5">
                            <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                    projectPercentage >= 100 ? 'bg-secondary' : 'bg-primary'
                                }`} 
                                style={{ width: `${projectPercentage}%` }} 
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            {projectPercentage >= 100 ? "Limite de projetos atingido" : `${planLimit - activeProjectsCount} espaço(s) livre(s)`}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions (Ações Rápidas) */}
            <div>
                <h2 className="text-lg font-bold tracking-tight mb-4 text-foreground/90">Acesso Rápido</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Button 
                        variant="outline"
                        className="h-16 justify-between text-base border-primary/20 hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 shadow-sm transition-all group"
                        onClick={() => router.push("/projects")}
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary group-hover:scale-110 transition-transform">
                                <Plus className="h-5 w-5" />
                            </div>
                            <span className="font-semibold text-foreground">Criar Projeto</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                    </Button>
                    
                    <Button 
                        variant="outline" 
                        className="h-16 justify-between text-base border-secondary/20 hover:border-secondary/50 hover:bg-secondary/5 dark:hover:bg-secondary/10 shadow-sm transition-all group"
                        onClick={() => router.push("/library")}
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-secondary/10 rounded-lg text-secondary group-hover:scale-110 transition-transform">
                                <FolderIcon className="h-5 w-5" />
                            </div>
                            <span className="font-semibold text-foreground">Ir para Biblioteca</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                    </Button>
                    
                    <Button 
                        variant="outline" 
                        className="h-16 justify-between text-base border-slate-200 hover:border-slate-400 hover:bg-muted shadow-sm transition-all group"
                        onClick={() => router.push("/finance")}
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 group-hover:scale-110 transition-transform">
                                <Wallet className="h-5 w-5" />
                            </div>
                            <span className="font-semibold text-foreground">Lançamento Financeiro</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                    </Button>
                </div>
            </div>

            {/* Grid de Conteúdo Secundário (Projetos, Compromissos, Clipper) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                
                {/* Coluna 1: Projetos Recentes */}
                <div className="lg:col-span-1 flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b pb-2">
                        <h2 className="text-xl font-bold tracking-tight text-foreground/90 flex items-center gap-2">
                            <FolderGit2 className="h-5 w-5 text-primary" /> Continuar Trabalhando
                        </h2>
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 font-semibold p-0 h-auto" onClick={() => router.push("/projects")}>
                            Ver Todos
                        </Button>
                    </div>
                    
                    {!data?.recent_projects || data.recent_projects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-dashed text-muted-foreground bg-muted/20">
                            <FolderIcon className="h-10 w-10 mb-3 text-muted-foreground/40" />
                            <p className="mb-4 text-sm font-medium">Você ainda não tem projetos ativos.</p>
                            <Button size="sm" onClick={() => router.push("/projects")}>
                                Criar Primeiro Projeto
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {data.recent_projects.map((proj) => (
                                <Link key={proj.id} href={`/projects/${proj.id}`}>
                                    <Card className="hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-300 cursor-pointer group">
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div>
                                                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{proj.name}</h3>
                                                {proj.client_name ? (
                                                    <p className="text-xs text-muted-foreground mt-0.5">Cliente: {proj.client_name}</p>
                                                ) : (
                                                    <p className="text-xs text-muted-foreground mt-0.5">Sem cliente vinculado</p>
                                                )}
                                            </div>
                                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Coluna 2: Próximos Compromissos (Agenda) */}
                <div className="lg:col-span-1 flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b pb-2">
                        <h2 className="text-xl font-bold tracking-tight text-foreground/90 flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-secondary" /> Próximos Compromissos
                        </h2>
                        <Button variant="ghost" size="sm" className="text-secondary hover:text-secondary/80 font-semibold p-0 h-auto" onClick={() => router.push("/calendar")}>
                            Agenda Completa
                        </Button>
                    </div>

                    {!data?.upcoming_events || data.upcoming_events.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-dashed text-muted-foreground bg-muted/20">
                            <Calendar className="h-10 w-10 mb-3 text-muted-foreground/40" />
                            <p className="text-sm font-medium mb-3">Nenhum compromisso para os próximos dias.</p>
                            <Button size="sm" variant="outline" className="border-secondary/20 text-secondary hover:bg-secondary/5 hover:border-secondary/50" onClick={() => router.push("/calendar")}>
                                Agendar Reunião
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {data.upcoming_events.map((event) => {
                                const start = new Date(event.start_time)
                                const timeFormatted = format(start, "HH:mm")
                                const dateFormatted = format(start, "dd 'de' MMM", { locale: ptBR })

                                return (
                                    <Card key={event.id} className="hover:border-secondary/30 transition-all duration-300 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-secondary/50" />
                                        <CardContent className="p-4 flex flex-col gap-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <h3 className="font-semibold text-foreground text-sm line-clamp-1">{event.title}</h3>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {dateFormatted} às {timeFormatted}
                                                    </p>
                                                </div>
                                                {event.meet_link && (
                                                    <Button 
                                                        size="sm" 
                                                        className="h-7 px-3 bg-secondary hover:bg-secondary/90 text-secondary-foreground text-xs gap-1 rounded-full shrink-0"
                                                        onClick={(e) => {
                                                            e.preventDefault()
                                                            window.open(event.meet_link, "_blank")
                                                        }}
                                                    >
                                                        <Video className="h-3 w-3" />
                                                        Entrar
                                                    </Button>
                                                )}
                                            </div>
                                            {event.project_name && (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <Badge variant="outline" className="text-[10px] py-0.5 px-2 font-medium bg-muted/50 border-muted">
                                                        Projeto: {event.project_name}
                                                    </Badge>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Coluna 3: Últimas Capturas (Biblioteca) */}
                <div className="lg:col-span-1 flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b pb-2">
                        <h2 className="text-xl font-bold tracking-tight text-foreground/90 flex items-center gap-2">
                            <Package className="h-5 w-5 text-indigo-500" /> Adições na Biblioteca
                        </h2>
                        <Button variant="ghost" size="sm" className="text-indigo-500 hover:text-indigo-600 font-semibold p-0 h-auto" onClick={() => router.push("/library")}>
                            Ver Biblioteca
                        </Button>
                    </div>

                    {!data?.recent_products || data.recent_products.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-dashed text-muted-foreground bg-muted/20">
                            <p className="text-sm font-medium">Nenhum produto salv recentemente.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {data.recent_products.map((prod) => (
                                <Link key={prod.id} href={`/library?product=${prod.id}`} className="group">
                                    <div className="flex flex-col rounded-xl border bg-card overflow-hidden hover:border-indigo-300 transition-all duration-300 h-full">
                                        <div className="relative aspect-[4/3] w-full bg-muted border-b overflow-hidden">
                                            {prod.image_url ? (
                                                <Image 
                                                    src={prod.image_url} 
                                                    alt={prod.name}
                                                    fill
                                                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                    sizes="(max-width: 768px) 50vw, 25vw"
                                                />
                                            ) : (
                                                <div className="flex w-full h-full items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-400 text-xs">
                                                    Sem imagem
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-2.5 flex flex-col justify-between flex-1 gap-1">
                                            <div>
                                                <p className="text-xs font-semibold text-foreground truncate pr-1 group-hover:text-primary transition-colors">
                                                    {prod.name}
                                                </p>
                                                {prod.store && (
                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                                                        <Store className="h-2.5 w-2.5 shrink-0" />
                                                        {prod.store}
                                                    </span>
                                                )}
                                            </div>
                                            {prod.price !== undefined && prod.price !== null && prod.price > 0 && (
                                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                                                    {formatCurrency(prod.price)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    )
}
