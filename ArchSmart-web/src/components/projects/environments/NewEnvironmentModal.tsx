import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
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
import { createClient } from "@/utils/supabase/client"
import { apiUrl } from "@/lib/api-url"

const environmentSchema = z.object({
    name: z.string().min(1, "O nome do ambiente é obrigatório."),
    type: z.string().optional()
})

type EnvironmentFormValues = z.infer<typeof environmentSchema>

interface NewEnvironmentModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    projectId: string
    onSuccess: (env: any) => void
}

export function NewEnvironmentModal({ isOpen, onOpenChange, projectId, onSuccess }: NewEnvironmentModalProps) {
    const { toast } = useToast()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<EnvironmentFormValues>({
        resolver: zodResolver(environmentSchema),
        defaultValues: {
            name: "",
            type: "Interna/Seca"
        }
    })

    const onSubmit = async (data: EnvironmentFormValues) => {
        try {
            setIsSubmitting(true)
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token || ""

            const res = await fetch(apiUrl(`/api/projects/${projectId}/environments`), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(data)
            })

            if (!res.ok) throw new Error("Falha ao criar ambiente")

            const newEnv = await res.json()
            toast({ title: "Ambiente Criado", description: "DNA Técnico gerado com sucesso." })
            onSuccess(newEnv)

            form.reset()
            onOpenChange(false)
        } catch (error) {
            toast({ variant: "destructive", title: "Ops!", description: "Não foi possível criar o ambiente." })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Novo Ambiente</DialogTitle>
                    <DialogDescription>
                        Crie um cômodo ou área para este projeto. O DNA técnico será iniciado vazio.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nome</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: Sala de Estar" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione o tipo" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="Interna/Seca">Área Interna Seca</SelectItem>
                                            <SelectItem value="Interna/Molhada">Área Interna Molhada</SelectItem>
                                            <SelectItem value="Externa">Área Externa / Fachada</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Criar
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
