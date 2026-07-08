import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const formSchema = z.object({
    description: z.string().min(2, "Descrição deve ter pelo menos 2 caracteres"),
    amount: z.coerce.number().min(0.01, "Valor deve ser maior que zero"),
    dueDate: z.string().min(1, "Selecione a data de vencimento"),
    category: z.string().optional(),
    recurrence: z.string().default("UNIQUE"),
    installments: z.coerce.number().min(1).default(1),
});

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
    const [editScope, setEditScope] = useState<"SINGLE" | "NEXT" | "ALL">("SINGLE");

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            description: "",
            amount: 0,
            dueDate: "",
            category: "",
            recurrence: "UNIQUE",
            installments: 1,
        },
    });

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                let formattedDate = "";
                if (initialData.due_date) {
                    const dateObj = new Date(initialData.due_date);
                    formattedDate = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`;
                }
                form.reset({
                    description: initialData.description || "",
                    amount: initialData.amount || 0,
                    dueDate: formattedDate,
                    category: initialData.category || "",
                    recurrence: "UNIQUE",
                    installments: 1,
                });
                setEditScope("SINGLE");
            } else {
                form.reset({
                    description: "",
                    amount: 0,
                    dueDate: "",
                    category: "",
                    recurrence: "UNIQUE",
                    installments: 1,
                });
            }
        }
    }, [isOpen, initialData, form]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsLoading(true);
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const method = initialData ? "PUT" : "POST";
            const endpoint = initialData ? `/api/financial/${initialData.id}` : "/api/financial";

            let reqBody: any = {
                type,
                description: values.description.trim(),
                amount: values.amount,
                category: values.category?.trim() || undefined,
                due_date: values.dueDate,
                status: initialData ? initialData.status : "PREDICTED",
            };

            if (isEditMode && initialData?.group_id) {
                reqBody.apply_to = editScope;
            }

            if (!initialData) {
                reqBody.recurrence = values.recurrence;
                reqBody.installments = values.recurrence === "INSTALLMENT" ? values.installments : 1;
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

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor="description-input">Descrição *</FormLabel>
                                    <FormControl>
                                        <Input
                                            id="description-input"
                                            placeholder="Ex: Consultoria online"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => {
                                const displayValue = field.value
                                    ? field.value.toLocaleString("pt-BR", {
                                          style: "currency",
                                          currency: "BRL",
                                      })
                                    : "";

                                return (
                                    <FormItem>
                                        <FormLabel htmlFor="amount-input">Valor *</FormLabel>
                                        <FormControl>
                                            <Input
                                                id="amount-input"
                                                placeholder="R$ 0,00"
                                                value={displayValue}
                                                onChange={(e) => {
                                                    const digits = e.target.value.replace(/\D/g, "");
                                                    const num = digits ? parseFloat(digits) / 100 : 0;
                                                    field.onChange(num);
                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                );
                            }}
                        />

                        <FormField
                            control={form.control}
                            name="dueDate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor="due-date-input">Vencimento / Data *</FormLabel>
                                    <FormControl>
                                        <Input
                                            id="due-date-input"
                                            type="date"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor="category-input">Categoria</FormLabel>
                                    <FormControl>
                                        <Input
                                            id="category-input"
                                            placeholder="Ex: Serviços, Impostos..."
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {!isEditMode && (
                            <FormField
                                control={form.control}
                                name="recurrence"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel htmlFor="recurrence-select">Repetição</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger id="recurrence-select">
                                                    <SelectValue placeholder="Selecione o tipo" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="UNIQUE">Única (Não repetir)</SelectItem>
                                                <SelectItem value="INSTALLMENT">Parcelada</SelectItem>
                                                <SelectItem value="RECURRING">Recorrente Mensal</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {!isEditMode && form.watch("recurrence") === "INSTALLMENT" && (
                            <FormField
                                control={form.control}
                                name="installments"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel htmlFor="installments-input">Número de Parcelas</FormLabel>
                                        <FormControl>
                                            <Input
                                                id="installments-input"
                                                type="number"
                                                min={2}
                                                max={48}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
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

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancelar</Button>
                            <Button 
                                type="submit" 
                                disabled={isLoading} 
                                className={type === "INCOME" 
                                    ? "bg-emerald-600 text-white hover:bg-emerald-600/90 dark:bg-emerald-700 dark:hover:bg-emerald-700/90" 
                                    : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                }
                            >
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
