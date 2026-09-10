"use client"

import { TrendingDown, TrendingUp, Wallet } from "lucide-react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"

import { formatCurrency } from "./format"
import type { DashboardLeanResponse } from "./types"

/** Saldo, receitas e despesas — os tres primeiros cards da grade de metricas. */
export function FinancialMetricCards({ data }: { data: DashboardLeanResponse | null }) {
    return (
        <>
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
        </>
    )
}
