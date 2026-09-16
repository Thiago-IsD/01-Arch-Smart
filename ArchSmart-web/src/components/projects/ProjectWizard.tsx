"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react"

import { ApiError } from "@/lib/api/errors"
import { useCriarProjeto, useEditarProjeto } from "@/features/projects/hooks"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Form } from "@/components/ui/form"

import { StepClient } from "./project-wizard/StepClient"
import { StepFinance } from "./project-wizard/StepFinance"
import { StepProject } from "./project-wizard/StepProject"
import { WizardStepper } from "./project-wizard/WizardStepper"
import { wizardSchema, type WizardFormValues } from "./project-wizard/schema"

interface ProjectWizardProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
    mode?: "create" | "edit"
    initialData?: any
}

export function ProjectWizard({ isOpen, onOpenChange, onSuccess, mode = "create", initialData }: ProjectWizardProps) {
    const [step, setStep] = useState(1)
    const { toast } = useToast()
    const router = useRouter()

    const criar = useCriarProjeto()
    const editar = useEditarProjeto()
    const isSubmitting = criar.isPending || editar.isPending

    const form = useForm<WizardFormValues>({
        resolver: zodResolver(wizardSchema),
        defaultValues: {
            name: "",
            service_type: "",
            client_name: "",
            client_email: "",
            client_phone: "",
            service_value: 0,
            payment_installments: 1,
            payment_method: "STANDARD",
            custom_installments: []
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
                payment_installments: initialData.payment_installments || 1,
                payment_method: initialData.payment_method || "STANDARD",
                custom_installments: initialData.custom_installments || []
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
                payment_installments: 1,
                payment_method: "STANDARD",
                custom_installments: []
            })
            setStep(1)
        }
    }, [isOpen, initialData, mode, form])

    const paymentMethod = form.watch("payment_method")
    const paymentInstallments = form.watch("payment_installments") || 1
    const serviceValue = form.watch("service_value") || 0
    const customInstallments = form.watch("custom_installments") || []

    useEffect(() => {
        if (paymentMethod === "CUSTOM" && paymentInstallments > 0) {
            const currentInstallments = form.getValues("custom_installments") || []
            if (currentInstallments.length !== paymentInstallments) {
                const draft = Array.from({ length: paymentInstallments }).map((_, i) => ({
                    description: currentInstallments[i]?.description || `Parcela ${i + 1}`,
                    amount: currentInstallments[i]?.amount || parseFloat((serviceValue / paymentInstallments).toFixed(2)),
                    due_date: currentInstallments[i]?.due_date || ""
                }))
                form.setValue("custom_installments", draft, { shouldValidate: true })
            }
        }
    }, [paymentInstallments, paymentMethod, form])

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
            if (mode === "edit") {
                await editar.mutateAsync({ id: String(initialData.id), dados: data })
            } else {
                await criar.mutateAsync(data)
            }

            toast({
                title: mode === "edit" ? "Projeto Atualizado" : "Projeto Criado",
                description: mode === "edit" ? "Os dados do projeto foram atualizados com sucesso." : `O projeto ${data.name} foi iniciado com sucesso.`,
            })

            form.reset()
            setStep(1)
            onOpenChange(false)
            onSuccess?.()

            // Orcamento e Apresentacoes renderizam ProjectHeader com dado do
            // SERVIDOR; sem isto, editar ali nao atualiza o cabecalho. Sai
            // quando as duas telas migrarem (spec de Projetos, "Mutacoes").
            router.refresh()
        } catch (erro) {
            const mensagem = erro instanceof ApiError ? erro.message : "Ocorreu um erro ao tentar salvar o projeto."
            toast({
                variant: "destructive",
                title: erro instanceof ApiError && erro.status === 403 ? "Limite de Plano" : "Ops!",
                description: mensagem,
            })
        }
    }

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
                <WizardStepper step={step} />

                <Form {...form}>
                    <form onSubmit={(e) => e.preventDefault()} className="space-y-4">

                        {/* STEP 1: PROJETO */}
                        <StepProject form={form} step={step} />

                        {/* STEP 2: CLIENTE */}
                        <StepClient form={form} step={step} />

                        {/* STEP 3: FINANCEIRO */}
                        <StepFinance
                            form={form}
                            step={step}
                            paymentMethod={paymentMethod}
                            paymentInstallments={paymentInstallments}
                            serviceValue={serviceValue}
                            customInstallments={customInstallments}
                        />

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
                                        onClick={form.handleSubmit(onSubmit, () => {
                                            toast({
                                                variant: "destructive",
                                                title: "Confira os campos",
                                                description: "Há informações pendentes ou inválidas no formulário.",
                                            })
                                        })}
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
