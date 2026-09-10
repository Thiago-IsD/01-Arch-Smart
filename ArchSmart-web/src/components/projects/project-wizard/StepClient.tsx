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

import type { WizardFormValues } from "./schema"

/** Etapa 2: dados do cliente. */
export function StepClient({ form, step }: { form: UseFormReturn<WizardFormValues>; step: number }) {
    return (
            <div className={`space-y-4 transition-all duration-300 ${step !== 2 ? 'hidden' : 'block'}`}>
                <FormField
                    control={form.control}
                    name="client_name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nome do Cliente / Casal</FormLabel>
                            <FormControl>
                                <Input placeholder="Ex: João e Maria" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="client_email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>E-mail do Cliente (Opcional)</FormLabel>
                            <FormControl>
                                <Input type="email" placeholder="cliente@email.com" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="client_phone"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Telefone / WhatsApp (Opcional)</FormLabel>
                            <FormControl>
                                <Input placeholder="(11) 99999-9999" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
    )
}
