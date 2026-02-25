import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Calculator } from "lucide-react"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "@/components/ui/sheet"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { createClient } from "@/utils/supabase/client"

const dnaSchema = z.object({
    floor_area: z.number().min(0, "A área não pode ser negativa"),
    wall_area: z.number().min(0, "A área não pode ser negativa"),
    ceiling_area: z.number().min(0, "A área não pode ser negativa"),
})

type DNAFormValues = z.infer<typeof dnaSchema>

interface DNAEditorSheetProps {
    environment: any
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: (updatedEnv: any) => void
}

export function DNAEditorSheet({ environment, isOpen, onOpenChange, onSuccess }: DNAEditorSheetProps) {
    const { toast } = useToast()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<DNAFormValues>({
        resolver: zodResolver(dnaSchema),
        defaultValues: {
            floor_area: 0,
            wall_area: 0,
            ceiling_area: 0
        }
    })

    // Reset form values when environment changes or sheet opens
    useEffect(() => {
        if (environment?.dna) {
            form.reset({
                floor_area: environment.dna.floor_area || 0,
                wall_area: environment.dna.wall_area || 0,
                ceiling_area: environment.dna.ceiling_area || 0,
            })
        }
    }, [environment, form, isOpen])

    const onSubmit = async (data: DNAFormValues) => {
        if (!environment) return

        try {
            setIsSubmitting(true)
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token || ""

            const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
            const res = await fetch(`${apiBase}/api/environments/${environment.id}/dna`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(data)
            })

            if (!res.ok) throw new Error("Falha ao salvar DNA Técnico")

            const updatedDna = await res.json()
            toast({ title: "Sucesso!", description: "DNA Técnico atualizado." })

            // Pass the updated environment shape back up
            onSuccess({
                ...environment,
                dna: updatedDna
            })

            onOpenChange(false)
        } catch (error) {
            toast({ variant: "destructive", title: "Ops!", description: "Erro ao salvar as áreas." })
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!environment) return null

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-[400px] flex flex-col h-full">
                <SheetHeader className="mb-6">
                    <SheetTitle className="flex items-center text-xl">
                        <Calculator className="w-5 h-5 mr-2 text-primary" />
                        DNA: {environment.name}
                    </SheetTitle>
                    <SheetDescription>
                        Preencha as áreas de revestimento precisas para ativar os blocos de orçamento automáticos na próxima aba.
                    </SheetDescription>
                </SheetHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex-1 flex flex-col justify-between">
                        <div className="space-y-4">
                            <FormField
                                control={form.control}
                                name="floor_area"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Área de Piso (m²)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                {...field}
                                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="wall_area"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Área Total de Parede (m²)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                {...field}
                                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="ceiling_area"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Área de Teto (Forro) (m²)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                {...field}
                                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <SheetFooter className="pt-6 border-t mt-auto">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                                Fechar
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Salvar DNA Técnico
                            </Button>
                        </SheetFooter>
                    </form>
                </Form>
            </SheetContent>
        </Sheet>
    )
}
