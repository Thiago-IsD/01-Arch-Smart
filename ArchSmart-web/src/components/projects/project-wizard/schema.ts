import * as z from "zod"

/** Schema e tipo do formulario do ProjectWizard, movidos na quebra da Tarefa 9. */
export const wizardSchema = z.object({
    name: z.string().min(3, "Nome do projeto deve ter pelo menos 3 caracteres"),
    service_type: z.string().min(1, "Selecione o tipo de serviço"),
    client_name: z.string().min(3, "Nome do cliente deve ter pelo menos 3 caracteres"),
    client_email: z.string().email("E-mail inválido").optional().or(z.literal('')),
    client_phone: z.string().optional().or(z.literal('')),
    service_value: z.number().min(0),
    payment_installments: z.number().min(1),
    payment_method: z.string(),
    custom_installments: z.array(z.object({
        amount: z.number().min(0),
        due_date: z.string(),
        description: z.string()
    })).optional()
}).superRefine((val, ctx) => {
    // Só validamos o cronograma quando o recebimento é Personalizado. No modo
    // Padrão o array pode conter rascunhos (datas vazias) e NÃO deve bloquear
    // o envio — por isso a checagem de datas saiu do schema base para cá.
    if (val.payment_method !== "CUSTOM") return

    const items = val.custom_installments || []

    const missingDate = items.some((it) => !it.due_date || it.due_date.length < 10)
    if (missingDate) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Preencha a data de todas as parcelas.",
            path: ["custom_installments"]
        })
        return
    }

    const sum = items.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    if (Math.abs(sum - val.service_value) > 0.01) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "A soma das parcelas deve ser igual ao Valor Fechado do Serviço.",
            path: ["custom_installments"]
        })
    }
})

export type WizardFormValues = z.infer<typeof wizardSchema>
