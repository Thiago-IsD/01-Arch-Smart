"use client"

import type { UseFormReturn } from "react-hook-form"

import { Input } from "@/components/ui/input"
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import type { WizardFormValues } from "./schema"

interface StepFinanceProps {
    form: UseFormReturn<WizardFormValues>
    step: number
    paymentMethod: string
    paymentInstallments: number
    serviceValue: number
    customInstallments: { amount: number; due_date: string; description: string }[]
}

/** Etapa 3: valor, parcelas e o cronograma personalizado. */
export function StepFinance({
    form,
    step,
    paymentMethod,
    paymentInstallments,
    serviceValue,
    customInstallments,
}: StepFinanceProps) {
    return (
            <div className={`space-y-4 transition-all duration-300 ${step !== 3 ? 'hidden' : 'block'}`}>
                <FormField
                    control={form.control}
                    name="service_value"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Valor Fechado (R$)</FormLabel>
                            <FormControl>
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    {...field}
                                    onChange={e => field.onChange(Number(e.target.value))}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="payment_installments"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Número de Parcelas</FormLabel>
                            <FormControl>
                                <Input
                                    type="number"
                                    min="1"
                                    max="120"
                                    {...field}
                                    onChange={e => field.onChange(Number(e.target.value))}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="payment_method"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Tipo de Recebimento</FormLabel>
                            <Select
                                onValueChange={(value) => {
                                    field.onChange(value)
                                    // Ao voltar para Padrão, limpa o rascunho de parcelas
                                    // para não arrastar dados que bloqueariam o envio.
                                    if (value === "STANDARD") {
                                        form.setValue("custom_installments", [], { shouldValidate: false })
                                    }
                                }}
                                value={field.value}
                            >
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="STANDARD">Padrão Mensal (A cada 30 dias)</SelectItem>
                                    <SelectItem value="CUSTOM">Personalizado (Datas/Valores Manuais)</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {paymentMethod === "CUSTOM" && (
                    <div className="space-y-3 mt-4 border-t pt-4">
                        <h4 className="text-sm font-semibold tracking-tight">Cronograma Personalizado</h4>
                        <div className="max-h-[220px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                            {Array.from({ length: paymentInstallments }).map((_, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2 items-center text-sm bg-muted/30 p-2 rounded-md border">
                                    <div className="col-span-12 font-medium text-xs mb-1">
                                        Parcela {index + 1}
                                    </div>
                                    <div className="col-span-12 sm:col-span-4">
                                        <FormField
                                            control={form.control}
                                            name={`custom_installments.${index}.due_date`}
                                            render={({ field }) => (
                                                <Input type="date" className="h-8 text-xs" {...field} />
                                            )}
                                        />
                                    </div>
                                    <div className="col-span-12 sm:col-span-8">
                                        <FormField
                                            control={form.control}
                                            name={`custom_installments.${index}.amount`}
                                            render={({ field }) => (
                                                <div className="relative">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">R$</span>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        className="h-8 text-xs pl-7"
                                                        {...field}
                                                        onChange={e => {
                                                            field.onChange(Number(e.target.value))
                                                            form.trigger("custom_installments") // trigger validation
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="bg-muted p-3 rounded-lg flex items-center justify-between text-sm mt-4">
                            <span className="font-semibold text-muted-foreground">Soma das Parcelas:</span>
                            <span className={`font-bold ${Math.abs(customInstallments.reduce((acc, curr) => acc + (curr.amount || 0), 0) - serviceValue) > 0.01 ? "text-red-500" : "text-emerald-500"}`}>
                                R$ {customInstallments.reduce((acc, curr) => acc + (curr.amount || 0), 0).toFixed(2)} / R$ {serviceValue?.toFixed(2)}
                            </span>
                        </div>
                        {form.formState.errors.custom_installments && (
                            <p className="text-xs text-red-500 mt-1 font-medium">{form.formState.errors.custom_installments.message}</p>
                        )}
                    </div>
                )}
            </div>
    )
}
