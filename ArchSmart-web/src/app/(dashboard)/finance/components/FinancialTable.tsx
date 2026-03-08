import React, { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Link as LinkIcon, FolderOutput, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { apiUrl } from "@/lib/api-url";
import { useToast } from "@/hooks/use-toast";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FinancialEntry {
    id: string;
    type: "INCOME" | "EXPENSE";
    status: "PREDICTED" | "REALIZED";
    amount: number;
    due_date: string;
    description: string;
    category?: string;
    project_id?: string;
    project_name?: string;
    group_id?: string;
    installment_number?: number;
}

interface FinancialTableProps {
    entries: FinancialEntry[];
    onStatusToggled: () => void;
    onEdit: (entry: FinancialEntry) => void;
    onDelete: (id: string, applyTo: "SINGLE" | "NEXT" | "ALL") => void;
}

export function FinancialTable({ entries, onStatusToggled, onEdit, onDelete }: FinancialTableProps) {
    const { toast } = useToast();
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [entryToDelete, setEntryToDelete] = useState<FinancialEntry | null>(null);
    const [deleteScope, setDeleteScope] = useState<"SINGLE" | "NEXT" | "ALL">("SINGLE");

    const handleToggleStatus = async (id: string) => {
        setTogglingId(id);
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch(apiUrl(`/api/financial/${id}/status`), {
                method: "PATCH",
                headers: { "Authorization": `Bearer ${session.access_token}` }
            });

            if (res.ok) {
                onStatusToggled(); // Trigger parent reload
            } else {
                toast({ variant: "destructive", title: "Erro", description: "Falha ao alterar status." });
            }
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Conexão", description: "Problema ao contatar servidor." });
        } finally {
            setTogglingId(null);
        }
    };

    if (entries.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500 border rounded-xl bg-slate-50/50 border-dashed">
                <FolderOutput className="w-10 h-10 mb-4 text-slate-300" />
                <p>Nenhuma movimentação encontrada para o período.</p>
            </div>
        );
    }

    return (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden text-sm">
            <Table>
                <TableHeader className="bg-slate-50">
                    <TableRow>
                        <TableHead className="w-[120px]">Vencimento</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="w-[120px] text-center">Pago/Recebido</TableHead>
                        <TableHead className="w-[60px] text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {entries.map((entry) => (
                        <TableRow key={entry.id} className="group hover:bg-slate-50/60 transition-colors">
                            <TableCell className="font-medium text-slate-600">
                                {format(new Date(entry.due_date), "dd MMM, yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-900 line-clamp-1">{entry.description}</span>
                                        {entry.group_id && (
                                            <Badge variant="outline" className="text-[10px] h-4 px-1 py-0 font-medium text-slate-400 border-slate-200">Em Série</Badge>
                                        )}
                                    </div>
                                    {entry.project_name && (
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                            <LinkIcon className="w-3 h-3" />
                                            {entry.project_name}
                                        </div>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                {entry.category ? (
                                    <Badge variant="secondary" className="font-normal border-slate-200">{entry.category}</Badge>
                                ) : (
                                    <span className="text-slate-400 italic text-xs">Sem categoria</span>
                                )}
                            </TableCell>
                            <TableCell className="text-right">
                                <div className={`flex items-center justify-end gap-1.5 font-bold ${entry.type === "INCOME" ? "text-emerald-600" : "text-red-600"}`}>
                                    {entry.type === "INCOME" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                    R$ {entry.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </div>
                            </TableCell>
                            <TableCell className="text-center">
                                <div className="flex flex-col gap-2 items-center justify-center">
                                    <Switch
                                        checked={entry.status === "REALIZED"}
                                        disabled={togglingId === entry.id}
                                        onCheckedChange={() => handleToggleStatus(entry.id)}
                                        className={entry.type === "INCOME" ? "data-[state=checked]:bg-emerald-600" : "data-[state=checked]:bg-slate-900"}
                                    />
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${entry.status === "REALIZED" ? "text-emerald-700" : "text-slate-400"}`}>
                                        {entry.status === "REALIZED" ? "Baixado" : "Prévia"}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <span className="sr-only">Abrir menu</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => onEdit(entry)} className="cursor-pointer">
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setEntryToDelete(entry)} className="cursor-pointer text-destructive focus:text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Excluir
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <AlertDialog open={!!entryToDelete} onOpenChange={(open) => {
                if (!open) {
                    setEntryToDelete(null);
                    setDeleteScope("SINGLE");
                }
            }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Isso excluirá permanentemente a movimentação financeira selecionada.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {entryToDelete?.group_id && (
                        <div className="py-4 border-y border-slate-100 my-2">
                            <Label className="text-sm font-semibold text-slate-700 mb-3 block">Esta movimentação faz parte de uma série recorrente/parcelada. Como deseja prosseguir com a exclusão?</Label>
                            <RadioGroup value={deleteScope} onValueChange={(val: any) => setDeleteScope(val)} className="flex flex-col gap-3 mt-2">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="SINGLE" id="del-single" />
                                    <Label htmlFor="del-single" className="text-slate-600 font-normal">Excluir apenas esta parcela</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="NEXT" id="del-next" />
                                    <Label htmlFor="del-next" className="text-slate-600 font-normal">Excluir esta e todas as parcelas futuras pendentes</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="ALL" id="del-all" />
                                    <Label htmlFor="del-all" className="text-slate-600 font-normal">Excluir todas as parcelas pendentes desta série</Label>
                                </div>
                            </RadioGroup>
                        </div>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (entryToDelete) onDelete(entryToDelete.id, deleteScope);
                                setEntryToDelete(null);
                                setDeleteScope("SINGLE");
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Sim, excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
