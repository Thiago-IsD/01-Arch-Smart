"use client"

import { useRouter } from "next/navigation"
import { ChevronRight, FolderIcon, Plus, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Os tres atalhos de "Acesso Rapido". */
export function QuickActions() {
    const router = useRouter()

    return (
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
    )
}
