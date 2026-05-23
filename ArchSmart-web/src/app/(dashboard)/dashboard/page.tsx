"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, FolderIcon, Wallet, Loader2, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
}

interface DashboardLeanResponse {
    user_first_name: string
    recent_projects: RecentProject[]
    recent_products: RecentProduct[]
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
    const router = useRouter()
    const { toast } = useToast()

    const [userName, setUserName] = useState<string>("Usuário")
    const [data, setData] = useState<DashboardLeanResponse | null>(null)
    const [loading, setLoading] = useState(true)

    // Buscar dados do usuário e do dashboard
    useEffect(() => {
        let isMounted = true

        async function fetchDashboard() {
            setLoading(true)
            try {
                const supabase = createClient()
                const { data: { session } } = await supabase.auth.getSession()

                if (!session) {
                    router.push("/auth/login")
                    return
                }

                // Não lemos mais do metadata local da sessão ("User Renamed" hardcoded no banco de auth)
                // Usaremos o nome real que vier do backend!

                // Buscar dados do dashboard
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
                    setUserName(dashboardData.user_first_name)
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

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return (
        <div className="flex flex-col gap-8 p-6 lg:p-8 w-full">
            
            {/* Header / Saudação */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Olá, {userName}</h1>
                <p className="text-muted-foreground mt-1 text-lg">
                    Bem-vindo(a) de volta! O que vamos fazer hoje?
                </p>
            </div>

            {/* Quick Actions (Linha 1) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Button 
                    className="h-14 justify-start text-base gap-3"
                    onClick={() => router.push("/projects")}
                >
                    <Plus className="h-5 w-5" />
                    Criar Projeto
                </Button>
                <Button 
                    variant="outline" 
                    className="h-14 justify-start text-base gap-3 border-emerald-600/30 hover:bg-emerald-50 text-emerald-700"
                    onClick={() => router.push("/library")}
                >
                    <FolderIcon className="h-5 w-5" />
                    Ir para Biblioteca
                </Button>
                <Button 
                    variant="outline" 
                    className="h-14 justify-start text-base gap-3 border-blue-600/30 hover:bg-blue-50 text-blue-700"
                    onClick={() => router.push("/finance")}
                >
                    <Wallet className="h-5 w-5" />
                    Lançamento Financeiro
                </Button>
            </div>

            {/* Loading State Spinner */}
            {loading ? (
                <div className="flex flex-col items-center justify-center flex-1 h-64 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-4" />
                    <p>Carregando seu espaço de trabalho...</p>
                </div>
            ) : (
                /* Grid de Conteúdo (Linha 2) */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    
                    {/* Coluna Esquerda: Projetos Recentes */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold tracking-tight">Continuar Trabalhando</h2>
                            <Button variant="ghost" size="sm" className="hidden sm:flex text-muted-foreground hover:text-foreground" onClick={() => router.push("/projects")}>
                                Ver Todos
                            </Button>
                        </div>
                        
                        {!data?.recent_projects || data.recent_projects.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-dashed text-muted-foreground bg-muted/20">
                                <FolderIcon className="h-10 w-10 mb-3 text-muted-foreground/50" />
                                <p className="mb-4">Você ainda não tem projetos ativos.</p>
                                <Button variant="outline" onClick={() => router.push("/projects")}>
                                    Criar Projeto
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {data.recent_projects.map((proj) => (
                                    <Link key={proj.id} href={`/projects/${proj.id}`}>
                                        <Card className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer group">
                                            <CardContent className="p-4 flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-medium group-hover:text-primary transition-colors">{proj.name}</h3>
                                                    {proj.client_name && (
                                                        <p className="text-sm text-muted-foreground">{proj.client_name}</p>
                                                    )}
                                                </div>
                                                <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Coluna Direita: Últimas Capturas */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold tracking-tight">Adições Recentes na Biblioteca</h2>
                            <Button variant="ghost" size="sm" className="hidden sm:flex text-muted-foreground hover:text-foreground" onClick={() => router.push("/library")}>
                                Ver Biblioteca
                            </Button>
                        </div>

                        {!data?.recent_products || data.recent_products.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-dashed text-muted-foreground bg-muted/20">
                                <p>Nenhum produto salvo na biblioteca recentemente.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {data.recent_products.map((prod) => (
                                    <Link key={prod.id} href={`/library?product=${prod.id}`}>
                                        <div className="group relative aspect-square rounded-md overflow-hidden bg-muted border hover:border-primary/50 transition-all">
                                            {prod.image_url ? (
                                                <img 
                                                    src={prod.image_url} 
                                                    alt={prod.name}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                />
                                            ) : (
                                                <div className="flex w-full h-full items-center justify-center bg-gray-100 text-gray-400 group-hover:bg-gray-200 transition-colors">
                                                    Sem imagem
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1.5 truncate pr-1 group-hover:text-foreground transition-colors">{prod.name}</p>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
