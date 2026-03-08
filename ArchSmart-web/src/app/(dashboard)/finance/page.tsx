"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FinancialTable } from "./components/FinancialTable";
import { QuickEntryDialog } from "./components/QuickEntryDialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/utils/supabase/client";
import { apiUrl } from "@/lib/api-url";
import { useToast } from "@/hooks/use-toast";
import { Wallet, TrendingUp, TrendingDown, Plus, Loader2 } from "lucide-react";

export default function FinancialDashboard() {
    const { toast } = useToast();

    const currentDate = new Date();
    const [month, setMonth] = useState<string>((currentDate.getMonth() + 1).toString());
    const [year, setYear] = useState<string>(currentDate.getFullYear().toString());

    const [summary, setSummary] = useState({ balance: 0, total_income: 0, total_expense: 0 });
    const [entries, setEntries] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogType, setDialogType] = useState<"INCOME" | "EXPENSE">("INCOME");
    const [entryToEdit, setEntryToEdit] = useState<any>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const headers = { "Authorization": `Bearer ${session.access_token}` };

            // Fetch Summary
            const summaryRes = await fetch(apiUrl(`/api/financial/summary?month=${month}&year=${year}`), { headers });
            if (summaryRes.ok) {
                const summaryData = await summaryRes.json();
                setSummary(summaryData);
            }

            // Fetch Entries
            const entriesRes = await fetch(apiUrl(`/api/financial?month=${month}&year=${year}`), { headers });
            if (entriesRes.ok) {
                const entriesData = await entriesRes.json();
                setEntries(entriesData);
            }
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erro", description: "Falha ao carregar dados financeiros." });
        } finally {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [month, year]);

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [month, year]);

    const openDialog = (type: "INCOME" | "EXPENSE", entry?: any) => {
        setDialogType(type);
        setEntryToEdit(entry || null);
        setIsDialogOpen(true);
    };

    const handleEdit = (entry: any) => {
        openDialog(entry.type, entry);
    };

    const handleDelete = async (id: string, applyTo: "SINGLE" | "NEXT" | "ALL" = "SINGLE") => {
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch(apiUrl(`/api/financial/${id}?apply_to=${applyTo}`), {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${session.access_token}` }
            });

            if (res.ok) {
                toast({ title: "Excluída", description: "Movimentação apaga com sucesso." });
                fetchData();
            } else {
                toast({ variant: "destructive", title: "Erro", description: "Falha ao excluir." });
            }
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erro de conexão", description: "Tente novamente mais tarde." });
        }
    };

    const months = [
        { value: "1", label: "Janeiro" }, { value: "2", label: "Fevereiro" },
        { value: "3", label: "Março" }, { value: "4", label: "Abril" },
        { value: "5", label: "Maio" }, { value: "6", label: "Junho" },
        { value: "7", label: "Julho" }, { value: "8", label: "Agosto" },
        { value: "9", label: "Setembro" }, { value: "10", label: "Outubro" },
        { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" }
    ];

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 7 }, (_, i) => (currentYear - 3 + i).toString());

    return (
        <div className="flex-1 space-y-6 max-w-7xl mx-auto w-full pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Financeiro</h1>
                    <p className="text-muted-foreground mt-1">Gerencie suas receitas, despesas e fluxo de caixa.</p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Select value={month} onValueChange={setMonth}>
                        <SelectTrigger className="w-[140px] bg-white">
                            <SelectValue placeholder="Mês" />
                        </SelectTrigger>
                        <SelectContent>
                            {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={year} onValueChange={setYear}>
                        <SelectTrigger className="w-[100px] bg-white">
                            <SelectValue placeholder="Ano" />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-white shadow-sm border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Saldo em Caixa Realizado</CardTitle>
                        <Wallet className="h-4 w-4 text-slate-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">R$ {summary.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                        <p className="text-xs text-muted-foreground mt-1">Saldo acumulado geral</p>
                    </CardContent>
                </Card>
                <Card className="bg-white shadow-sm border-emerald-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Receitas do Mês</CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">R$ {summary.total_income.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                        <p className="text-xs text-muted-foreground mt-1">Previsão e Realizado</p>
                    </CardContent>
                </Card>
                <Card className="bg-white shadow-sm border-red-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Despesas do Mês</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">R$ {summary.total_expense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                        <p className="text-xs text-muted-foreground mt-1">Previsão e Realizado</p>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center mt-8 mb-4 gap-4">
                <h2 className="text-lg font-bold text-slate-800">Movimentações de {months.find(m => m.value === month)?.label} {year}</h2>
                <div className="flex gap-2">
                    <Button onClick={() => openDialog("INCOME")} className="bg-emerald-600 hover:bg-emerald-700 h-9 px-4">
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Receita
                    </Button>
                    <Button onClick={() => openDialog("EXPENSE")} variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 h-9 px-4">
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Despesa
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                </div>
            ) : (
                <FinancialTable
                    entries={entries}
                    onStatusToggled={fetchData}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />
            )}

            <QuickEntryDialog
                isOpen={isDialogOpen}
                onClose={() => {
                    setIsDialogOpen(false);
                    setEntryToEdit(null);
                }}
                type={dialogType}
                onSuccess={fetchData}
                initialData={entryToEdit}
            />
        </div>
    );
}
