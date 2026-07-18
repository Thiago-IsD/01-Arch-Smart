import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";

interface QuickEntryDialogProps {
    isOpen: boolean;
    onClose: () => void;
    type: "INCOME" | "EXPENSE";
    onSuccess: () => void;
    initialData?: any;
}

// ---------------------------------------------------------------------------
// Máscara monetária (pt-BR)
// ---------------------------------------------------------------------------

/** Converte a digitação bruta em uma string formatada "1.234,56" (centavos à direita). */
function formatCurrencyBRL(raw: string): string {
    const onlyDigits = raw.replace(/\D/g, "");
    if (!onlyDigits) return "";
    const value = parseInt(onlyDigits, 10) / 100;
    return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Converte a string mascarada de volta para número (float). */
function parseCurrencyToNumber(masked: string): number {
    const onlyDigits = masked.replace(/\D/g, "");
    if (!onlyDigits) return 0;
    return parseInt(onlyDigits, 10) / 100;
}

/** Converte um número (ex: vindo do backend) para a string mascarada. */
function numberToCurrencyMask(value: number): string {
    return formatCurrencyBRL(String(Math.round(value * 100)));
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const formSchema = z
    .object({
        description: z.string().trim().min(1, "Informe uma descrição."),
        amount: z.string().refine((v) => parseCurrencyToNumber(v) > 0, "Informe um valor maior que zero."),
        dueDate: z.string().min(1, "Selecione a data de vencimento."),
        category: z.string().optional(),
        recurrence: z.enum(["UNIQUE", "INSTALLMENT", "RECURRING"]),
        installments: z.string().optional(),
        editScope: z.enum(["SINGLE", "NEXT", "ALL"]),
    })
    .refine(
        (data) => {
            if (data.recurrence !== "INSTALLMENT") return true;
            const n = parseInt(data.installments || "1", 10);
            return n >= 2 && n <= 48;
        },
        { message: "Informe entre 2 e 48 parcelas.", path: ["installments"] }
    );

type FormValues = z.infer<typeof formSchema>;

const DEFAULT_VALUES: FormValues = {
    description: "",
    amount: "",
    dueDate: "",
    category: "",
    recurrence: "UNIQUE",
    installments: "1",
    editScope: "SINGLE",
};

export function QuickEntryDialog({ isOpen, onClose, type, onSuccess, initialData }: QuickEntryDialogProps) {
    const { toast } = useToast();
    const isEditMode = !!initialData;

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: DEFAULT_VALUES,
    });

    const { isSubmitting } = form.formState;
    const recurrence = form.watch("recurrence");

    // Preenche/reseta o formulário ao abrir
    useEffect(() => {
        if (!isOpen) return;

        if (initialData) {
            let dueDate = "";
            if (initialData.due_date) {
                const d = new Date(initialData.due_date);
                dueDate = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
            }
            form.reset({
                description: initialData.description || "",
                amount: initialData.amount ? numberToCurrencyMask(initialData.amount) : "",
                dueDate,
                category: initialData.category || "",
                recurrence: "UNIQUE",
                installments: "1",
                editScope: "SINGLE",
            });
        } else {
            form.reset(DEFAULT_VALUES);
        }
    }, [isOpen, initialData, form]);

    const onSubmit = async (values: FormValues) => {
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast({ variant: "destructive", title: "Sessão expirada", description: "Faça login novamente." });
                return;
            }

            const method = initialData ? "PUT" : "POST";
            const endpoint = initialData ? `/api/financial/${initialData.id}` : "/api/financial";

            const reqBody: any = {
                type,
                description: values.description.trim(),
                amount: parseCurrencyToNumber(values.amount),
                category: values.category?.trim() || undefined,
                due_date: values.dueDate,
            };

            reqBody.status = initialData ? initialData.status : "PREDICTED";

            if (isEditMode && initialData?.group_id) {
                reqBody.apply_to = values.editScope;
            }

            if (!initialData) {
                reqBody.recurrence = values.recurrence;
                reqBody.installments = parseInt(values.installments || "1", 10) || 1;
            }

            const res = await fetch(apiUrl(endpoint), {
                method,
                headers: {
                    "Authorization": `Bearer ${session.access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(reqBody),
            });

            if (res.ok) {
                toast({ title: "Sucesso", description: initialData ? "Lançamento atualizado." : "Lançamento registrado." });
                onSuccess();
                onClose();
                form.reset(DEFAULT_VALUES);
            } else {
                toast({ variant: "destructive", title: "Erro", description: "Falha ao registrar transação." });
            }
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Problema de conexão", description: "Tente novamente mais tarde." });
        }
    };

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
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descrição</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: Consultoria online" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Valor (R$)</FormLabel>
                                    <div className="relative">
                                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                            R$
                                        </span>
                                        <FormControl>
                                            <Input
                                                inputMode="decimal"
                                                placeholder="0,00"
                                                className="pl-9"
                                                value={field.value}
                                                onChange={(e) => field.onChange(formatCurrencyBRL(e.target.value))}
                                                onBlur={field.onBlur}
                                                name={field.name}
                                                ref={field.ref}
                                            />
                                        </FormControl>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="dueDate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Vencimento / Data</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} />
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
                                    <FormLabel>Categoria</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: Serviços, Impostos..." {...field} />
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
                                        <FormLabel>Repetição</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger>
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

                        {recurrence === "INSTALLMENT" && !isEditMode && (
                            <FormField
                                control={form.control}
                                name="installments"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Número de Parcelas</FormLabel>
                                        <FormControl>
                                            <Input type="number" min={2} max={48} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {isEditMode && initialData?.group_id && (
                            <FormField
                                control={form.control}
                                name="editScope"
                                render={({ field }) => (
                                    <FormItem className="pt-2 border-t border-border mt-2">
                                        <Label className="text-sm font-semibold text-foreground mb-1 block">Aplicar alterações em:</Label>
                                        <RadioGroup value={field.value} onValueChange={field.onChange} className="flex flex-col gap-2 mt-2">
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="SINGLE" id="edit-single" />
                                                <Label htmlFor="edit-single" className="text-muted-foreground font-normal">Somente nesta parcela</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="NEXT" id="edit-next" />
                                                <Label htmlFor="edit-next" className="text-muted-foreground font-normal">Nesta e nas parcelas futuras pendentes</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="ALL" id="edit-all" />
                                                <Label htmlFor="edit-all" className="text-muted-foreground font-normal">Em todas as parcelas pendentes da série</Label>
                                            </div>
                                        </RadioGroup>
                                    </FormItem>
                                )}
                            />
                        )}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className={type === "INCOME" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}
                            >
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
