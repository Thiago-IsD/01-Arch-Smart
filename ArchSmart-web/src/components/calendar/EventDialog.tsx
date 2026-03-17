"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, Trash2, Link, Calendar, Clock, FileText, Briefcase } from "lucide-react"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api-url"
import { createClient } from "@/utils/supabase/client"

// ---------------------------------------------------------------------------
// Schema de validação
// ---------------------------------------------------------------------------

const eventSchema = z.object({
    title: z.string().min(1, "Título é obrigatório"),
    project_id: z.string().optional().nullable(),
    start_time: z.string().min(1, "Data/hora de início é obrigatória"),
    end_time: z.string().min(1, "Data/hora de fim é obrigatória"),
    description: z.string().optional().nullable(),
    meet_link: z.string().optional().nullable(),
}).refine((data) => {
    if (data.start_time && data.end_time) {
        return new Date(data.end_time) > new Date(data.start_time)
    }
    return true
}, {
    message: "A data/hora de fim deve ser após a de início",
    path: ["end_time"],
})

type EventFormValues = z.infer<typeof eventSchema>

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface Project {
    id: string
    name: string
}

export interface CalendarEvent {
    id: string
    title: string
    start_time: string
    end_time: string
    description?: string | null
    meet_link?: string | null
    project_id?: string | null
    project_name?: string | null
}

interface EventDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Evento a ser editado; null = modo criação */
    event?: CalendarEvent | null
    /** Data pré-selecionada ao criar (clique em slot vazio) */
    defaultDate?: Date | null
    /** ID de projeto pré-selecionado (ex: dentro de um workspace de projeto) */
    lockedProjectId?: string | null
    /** Callbacks para atualizar o estado do pai */
    onCreated?: (event: CalendarEvent) => void
    onUpdated?: (event: CalendarEvent) => void
    onDeleted?: (eventId: string) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDatetimeLocal(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

async function getAuthHeaders(): Promise<HeadersInit> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token ?? ""}`,
    }
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function EventDialog({
    open,
    onOpenChange,
    event,
    defaultDate,
    lockedProjectId,
    onCreated,
    onUpdated,
    onDeleted,
}: EventDialogProps) {
    const isEditing = !!event
    const { toast } = useToast()
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [projects, setProjects] = useState<Project[]>([])

    // -----------------------------------------------------------------------
    // Form
    // -----------------------------------------------------------------------

    const form = useForm<EventFormValues>({
        resolver: zodResolver(eventSchema),
        defaultValues: {
            title: "",
            project_id: lockedProjectId ?? null,
            start_time: defaultDate ? toDatetimeLocal(defaultDate) : "",
            end_time: defaultDate ? toDatetimeLocal(new Date(defaultDate.getTime() + 60 * 60 * 1000)) : "",
            description: "",
            meet_link: "",
        },
    })

    // Reset ao abrir / trocar evento
    useEffect(() => {
        if (!open) return

        if (event) {
            form.reset({
                title: event.title,
                project_id: event.project_id ?? null,
                start_time: toDatetimeLocal(new Date(event.start_time)),
                end_time: toDatetimeLocal(new Date(event.end_time)),
                description: event.description ?? "",
                meet_link: event.meet_link ?? "",
            })
        } else {
            form.reset({
                title: "",
                project_id: lockedProjectId ?? null,
                start_time: defaultDate ? toDatetimeLocal(defaultDate) : "",
                end_time: defaultDate ? toDatetimeLocal(new Date(defaultDate.getTime() + 60 * 60 * 1000)) : "",
                description: "",
                meet_link: "",
            })
        }
    }, [open, event, defaultDate]) // eslint-disable-line react-hooks/exhaustive-deps

    // -----------------------------------------------------------------------
    // Busca projetos
    // -----------------------------------------------------------------------

    useEffect(() => {
        if (!open) return
        let cancelled = false;

        (async () => {
            try {
                const headers = await getAuthHeaders()
                const res = await fetch(apiUrl("/api/projects"), { headers })
                if (!res.ok) return
                const data = await res.json()
                if (!cancelled) setProjects(data.items ?? data ?? [])
            } catch {
                // silently ignore — projects select é opcional
            }
        })()

        return () => { cancelled = true }
    }, [open])

    // -----------------------------------------------------------------------
    // Submit
    // -----------------------------------------------------------------------

    async function onSubmit(data: EventFormValues) {
        setIsSaving(true)
        try {
            const headers = await getAuthHeaders()
            const body = {
                title: data.title,
                project_id: data.project_id && data.project_id !== "none" ? data.project_id : null,
                start_time: new Date(data.start_time).toISOString(),
                end_time: new Date(data.end_time).toISOString(),
                description: data.description || null,
                meet_link: data.meet_link || null,
            }

            let res: Response
            if (isEditing) {
                res = await fetch(apiUrl(`/api/events/${event!.id}`), {
                    method: "PUT",
                    headers,
                    body: JSON.stringify(body),
                })
            } else {
                res = await fetch(apiUrl("/api/events"), {
                    method: "POST",
                    headers,
                    body: JSON.stringify(body),
                })
            }

            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.detail || "Erro ao salvar evento")
            }

            const saved: CalendarEvent = await res.json()
            toast({
                title: isEditing ? "Evento atualizado!" : "Evento criado!",
                description: saved.title,
            })

            if (isEditing) onUpdated?.(saved)
            else onCreated?.(saved)

            onOpenChange(false)
        } catch (err: any) {
            toast({ title: "Erro", description: err.message, variant: "destructive" })
        } finally {
            setIsSaving(false)
        }
    }

    // -----------------------------------------------------------------------
    // Delete
    // -----------------------------------------------------------------------

    async function onDelete() {
        if (!event) return
        setIsDeleting(true)
        try {
            const headers = await getAuthHeaders()
            const res = await fetch(apiUrl(`/api/events/${event.id}`), {
                method: "DELETE",
                headers,
            })

            if (!res.ok && res.status !== 204) {
                throw new Error("Erro ao excluir evento")
            }

            toast({ title: "Evento excluído!" })
            onDeleted?.(event.id)
            onOpenChange(false)
        } catch (err: any) {
            toast({ title: "Erro", description: err.message, variant: "destructive" })
        } finally {
            setIsDeleting(false)
        }
    }

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        {isEditing ? "Editar Evento" : "Novo Evento"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? "Atualize as informações do evento."
                            : "Preencha os dados para criar um novo evento na agenda."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                        {/* Título */}
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Título *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Nome do evento" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Projeto */}
                        <FormField
                            control={form.control}
                            name="project_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-1.5">
                                        <Briefcase className="h-3.5 w-3.5" /> Projeto
                                    </FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        value={field.value ?? "none"}
                                        disabled={!!lockedProjectId}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Nenhum projeto" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">Nenhum projeto</SelectItem>
                                            {projects.map((p) => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Datas */}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="start_time"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-1.5">
                                            <Clock className="h-3.5 w-3.5" /> Início *
                                        </FormLabel>
                                        <FormControl>
                                            <Input type="datetime-local" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="end_time"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-1.5">
                                            <Clock className="h-3.5 w-3.5" /> Fim *
                                        </FormLabel>
                                        <FormControl>
                                            <Input type="datetime-local" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Descrição */}
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-1.5">
                                        <FileText className="h-3.5 w-3.5" /> Descrição
                                    </FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Detalhes do evento..."
                                            className="resize-none"
                                            rows={3}
                                            {...field}
                                            value={field.value ?? ""}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Link da reunião */}
                        <FormField
                            control={form.control}
                            name="meet_link"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-1.5">
                                        <Link className="h-3.5 w-3.5" /> Link da Reunião
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            type="url"
                                            placeholder="https://meet.google.com/..."
                                            {...field}
                                            value={field.value ?? ""}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
                            {isEditing && (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="mr-auto"
                                    onClick={onDelete}
                                    disabled={isDeleting || isSaving}
                                >
                                    {isDeleting
                                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        : <Trash2 className="mr-2 h-4 w-4" />
                                    }
                                    Excluir
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isSaving || isDeleting}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isSaving || isDeleting}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isEditing ? "Salvar Alterações" : "Criar Evento"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
