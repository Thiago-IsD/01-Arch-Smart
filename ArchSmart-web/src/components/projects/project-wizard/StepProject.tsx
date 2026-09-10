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

/** Etapa 1: nome do projeto e tipo de servico. */
export function StepProject({ form, step }: { form: UseFormReturn<WizardFormValues>; step: number }) {
    return (
            <div className={`space-y-4 transition-all duration-300 ${step !== 1 ? 'hidden' : 'block'}`}>
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nome do Projeto</FormLabel>
                            <FormControl>
                                <Input placeholder="Ex: Apartamento Jardins" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="service_type"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Tipo de Serviço</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o escopo" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="Projeto Arquitetônico">Projeto Arquitetônico</SelectItem>
                                    <SelectItem value="Design de Interiores">Design de Interiores</SelectItem>
                                    <SelectItem value="Consultoria Express">Consultoria Express</SelectItem>
                                    <SelectItem value="Gestão de Obra">Gestão de Obra</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
    )
}
