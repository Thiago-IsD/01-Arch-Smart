"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/** O que a tela mostra enquanto /api/dashboard/lean nao respondeu. */
export function DashboardSkeleton() {
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
