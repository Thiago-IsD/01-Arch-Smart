import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { apiUrl } from "@/lib/api-url";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface QuickEntryDialogProps {
    isOpen: boolean;
    onClose: () => void;
    type: "INCOME" | "EXPENSE";
    onSuccess: () => void;
    initialData?: any;
}

export function QuickEntryDialog({ isOpen, onClose, type, onSuccess, initialData }: QuickEntryDialogProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    // Form fields
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState<string>("");
    const [category, setCategory] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [recurrence, setRecurrence] = useState("UNIQUE");
    const [installments, setInstallments] = useState("1");
    const [editScope, setEditScope] = useState<"SINGLE" | "NEXT" | "ALL">("SINGLE");

    useEffect(() => {
        if (isOpen && initialData) {
            setDescription(initialData.description || "");
            setAmount(initialData.amount ? initialData.amount.toString() : "");
            setCategory(initialData.category || "");

            // Format due_date to YYYY-MM-DD for the input
            if (initialData.due_date) {
                const dateObj = new Date(initialData.due_date);
                const localDateStr = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`;
                setDueDate(localDateStr);
            } else {
                setDueDate("");
            }

            setRecurrence("UNIQUE");
            setInstallments("1");
            setEditScope("SINGLE"); // Reset edit scope when opening for edit
        } else if (isOpen && !initialData) {
            setDescription("");
            setAmount("");
            setCategory("");
            setDueDate("");
            setRecurrence("UNIQUE");
            setInstallments("1");
            setEditScope("SINGLE"); // Reset edit scope for new entry
        }
    }, [isOpen, initialData]);

    const handleSave = async () => {
        if (!description || !amount || !dueDate) {
            toast({ variant: "destructive", title: "Campos obrigatórios", description: "Preencha descrição, valor e data." });
            return;
        }

        setIsLoading(true);
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // Determine Action (Create/POST vs Update/PUT)
            const method = initialData ? "PUT" : "POST";
            const endpoint = initialData ? `/api/financial/${initialData.id}` : "/api/financial";

            let reqBody: any = {
                type,
                description: description.trim(),
                amount: parseFloat(amount.replace(",", ".")),
                category: category.trim() || undefined,
                due_date: dueDate,
            };

            // Add status for existing entries, or default for new
            if (initialData) {
                reqBody.status = initialData.status;
            } else {
                reqBody.status = "PREDICTED";
            }

            if (isEditMode && initialData?.group_id) {
                reqBody.apply_to = editScope;
            }

            // Recurrence just exists in Creation!
            if (!initialData) {
                reqBody.recurrence = recurrence;
                reqBody.installments = parseInt(installments) || 1;
            }

            const res = await fetch(apiUrl(endpoint), {
                method: method,
                headers: {
                    "Authorization": `Bearer ${session.access_token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(reqBody)
            });

            if (res.ok) {
                toast({ title: "Sucesso", description: initialData ? "Lançamento atualizado." : "Lançamento registrado." });
                onSuccess();
                onClose();
                // Reset form
                setDescription("");
                setAmount("");
                setCategory("");
                setDueDate("");
                setRecurrence("UNIQUE");
                setInstallments("1");
            } else {
                toast({ variant: "destructive", title: "Erro", description: "Falha ao registrar transação." });
            }
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Problema de conexão", description: "Tente novamente mais tarde." });
        } finally {
            setIsLoading(false);
        }
    };

    const isEditMode = !!initialData;
    const title = isEditMode
        ? (type === "INCOME" ? "Editar Receita" : "Editar Despesa")
        : (type === "INCOME" ? "Nova Receita" : "Nova Despesa");

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>Preencha os dados da {type === "INCOME" ? "receita" : "despesa"} manual.</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">Descrição</label>
                        <Input
                            placeholder="Ex: Consultoria online"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">Valor (R$)</label>
                        <Input
                            type="number"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">Vencimento / Data</label>
                        <Input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">Categoria</label>
                        <Input
                            placeholder="Ex: Serviços, Impostos..."
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                        />
                    </div>

                    {!isEditMode && (
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium">Repetição</label>
                            <Select value={recurrence} onValueChange={setRecurrence}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o tipo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="UNIQUE">Única (Não repetir)</SelectItem>
                                    <SelectItem value="INSTALLMENT">Parcelada</SelectItem>
                                    <SelectItem value="RECURRING">Recorrente Mensal</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {recurrence === "INSTALLMENT" && !isEditMode && (
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium">Número de Parcelas</label>
                            <Input
                                type="number"
                                min={2}
                                max={48}
                                value={installments}
                                onChange={(e) => setInstallments(e.target.value)}
                            />
                        </div>
                    )}

                    {isEditMode && initialData?.group_id && (
                        <div className="pt-2 border-t border-slate-100 mt-2">
                            <Label className="text-sm font-semibold text-slate-700 mb-3 block">Aplicar alterações em:</Label>
                            <RadioGroup value={editScope} onValueChange={(val: any) => setEditScope(val)} className="flex flex-col gap-2 mt-2">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="SINGLE" id="edit-single" />
                                    <Label htmlFor="edit-single" className="text-slate-600 font-normal">Somente nesta parcela</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="NEXT" id="edit-next" />
                                    <Label htmlFor="edit-next" className="text-slate-600 font-normal">Nesta e nas parcelas futuras pendentes</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="ALL" id="edit-all" />
                                    <Label htmlFor="edit-all" className="text-slate-600 font-normal">Em todas as parcelas pendentes da série</Label>
                                </div>
                            </RadioGroup>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isLoading} className={type === "INCOME" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
