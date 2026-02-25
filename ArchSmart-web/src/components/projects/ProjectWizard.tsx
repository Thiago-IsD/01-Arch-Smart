"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, ArrowRight, ArrowLeft, Check, Wallet, User, PenTool } from "lucide-react"

import { createClient } from "@/utils/supabase/client"
import { apiUrl } from "@/lib/api-url"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Form,
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

const wizardSchema = z.object({
    name: z.string().min(3, "Nome do projeto deve ter pelo menos 3 caracteres"),
    service_type: z.string().min(1, "Selecione o tipo de serviço"),
    client_name: z.string().min(3, "Nome do cliente deve ter pelo menos 3 caracteres"),
    client_email: z.string().email("E-mail inválido").optional().or(z.literal('')),
    client_phone: z.string().optional().or(z.literal('')),
    service_value: z.number().min(0),
    payment_installments: z.number().min(1),
})

type WizardFormValues = z.infer<typeof wizardSchema>

interface ProjectWizardProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
    mode?: "create" | "edit"
    initialData?: any
}

export function ProjectWizard({ isOpen, onOpenChange, onSuccess, mode = "create", initialData }: ProjectWizardProps) {
    const [step, setStep] = useState(1)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { toast } = useToast()
    const router = useRouter()

    const form = useForm<WizardFormValues>({
        resolver: zodResolver(wizardSchema),
        defaultValues: {
            name: "",
            service_type: "",
            client_name: "",
            client_email: "",
            client_phone: "",
            service_value: 0,
            payment_installments: 1
        },
    })

    useEffect(() => {
        if (isOpen && initialData && mode === "edit") {
            form.reset({
                name: initialData.name || "",
                service_type: initialData.service_type || "",
                client_name: initialData.client?.name || initialData.client_name || "",
                client_email: initialData.client?.email || initialData.client_email || "",
                client_phone: initialData.client?.phone || initialData.client_phone || "",
                service_value: initialData.service_value || 0,
                payment_installments: initialData.payment_installments || 1
            })
            setStep(1)
        } else if (isOpen && mode === "create") {
            form.reset({
                name: "",
                service_type: "",
                client_name: "",
                client_email: "",
                client_phone: "",
                service_value: 0,
                payment_installments: 1
            })
            setStep(1)
        }
    }, [isOpen, initialData, mode, form])

    const handleNextStep = async () => {
        let fieldsToValidate: (keyof WizardFormValues)[] = []
        if (step === 1) fieldsToValidate = ['name', 'service_type']
        if (step === 2) fieldsToValidate = ['client_name', 'client_email', 'client_phone']

        const isStepValid = await form.trigger(fieldsToValidate)
        if (isStepValid) {
            setStep((prev) => prev + 1)
        }
    }

    const handlePrevStep = () => {
        setStep((prev) => prev - 1)
    }

    const onSubmit = async (data: WizardFormValues) => {
        if (step !== 3) return

        try {
            setIsSubmitting(true)

            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token || ""

            const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
            const endpoint = mode === "edit" ? `${apiBase}/api/projects/${initialData.id}` : `${apiBase}/api/projects`

            const res = await fetch(endpoint, {
                method: mode === "edit" ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data),
            })

            const responseData = await res.json()

            if (!res.ok) {
                if (res.status === 403) {
                    toast({
                        variant: "destructive",
                        title: "Limite de Plano",
                        description: responseData.detail || "Você atingiu o limite de projetos do seu plano.",
                    })
                    return
                }
                throw new Error(`Erro ao ${mode === 'edit' ? 'editar' : 'criar'} projeto`)
            }

            toast({
                title: mode === "edit" ? "Projeto Atualizado" : "Projeto Criado",
                description: mode === "edit" ? "Os dados do projeto foram atualizados com sucesso." : `O projeto ${data.name} foi iniciado com sucesso.`,
            })

            form.reset()
            setStep(1)
            onOpenChange(false)
            if (onSuccess) onSuccess()

            // Refresh Server Component
            router.refresh()

        } catch (error) {
            toast({
                variant: "destructive",
                title: "Ops!",
                description: "Ocorreu um erro ao tentar salvar o projeto.",
            })
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    // Step indicators UI
    const steps = [
        { num: 1, label: "Projeto", icon: PenTool },
        { num: 2, label: "Cliente", icon: User },
        { num: 3, label: "Financeiro", icon: Wallet }
    ]

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) {
                setTimeout(() => setStep(1), 300) // Reset after animation
            }
            onOpenChange(open)
        }}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader className="mb-4">
                    <DialogTitle>{mode === "edit" ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
                    <DialogDescription>
                        {mode === "edit" ? "Atualize as informações e detalhes do seu projeto." : "Preencha os dados em etapas para abrir um novo projeto."}
                    </DialogDescription>
                </DialogHeader>

                {/* Stepper Progress Header */}
                <div className="flex justify-between items-center mb-8 relative">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-muted rounded-full"></div>
                    <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${((step - 1) / 2) * 100}%` }}
                    ></div>

                    {steps.map((s) => {
                        const Icon = s.icon
                        const isActive = step >= s.num
                        return (
                            <div key={s.num} className="relative z-10 flex flex-col items-center gap-2">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-300 bg-background
                                    ${isActive ? 'border-primary text-primary' : 'border-muted text-muted-foreground'}`}>
                                    {step > s.num ? <Check className="w-5 h-5 text-primary" /> : <Icon className="w-5 h-5" />}
                                </div>
                                <span className={`text-xs font-medium absolute -bottom-6 w-max ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                                    {s.label}
                                </span>
                            </div>
                        )
                    })}
                </div>

                <Form {...form}>
                    <form onSubmit={(e) => e.preventDefault()} className="space-y-4">

                        {/* STEP 1: PROJETO */}
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

                        {/* STEP 2: CLIENTE */}
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

                        {/* STEP 3: FINANCEIRO */}
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
                        </div>

                        <DialogFooter className="mt-8 pt-4 border-t flex items-center justify-between sm:justify-between w-full">
                            <div className="flex w-full justify-between items-center">
                                {/* Back / Cancel Buttons */}
                                {step === 1 ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => onOpenChange(false)}
                                        disabled={isSubmitting}
                                    >
                                        Cancelar
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handlePrevStep}
                                        disabled={isSubmitting}
                                    >
                                        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                                    </Button>
                                )}

                                {/* Next / Submit Buttons */}
                                {step < 3 ? (
                                    <Button
                                        type="button"
                                        onClick={handleNextStep}
                                        disabled={isSubmitting}
                                    >
                                        Próximo <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        onClick={form.handleSubmit(onSubmit)}
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {mode === "edit" ? "Salvar Alterações" : "Criar Projeto"}
                                    </Button>
                                )}
                            </div>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
