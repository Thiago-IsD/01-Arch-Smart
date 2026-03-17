"use client"

import { useCallback, useEffect, useState } from "react"
import { format, startOfMonth, endOfMonth } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { SlotInfo, View } from "react-big-calendar"
import { Views } from "react-big-calendar"
import { Plus, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api-url"
import { createClient } from "@/utils/supabase/client"
import CalendarView from "@/components/calendar/CalendarView"
import EventDialog, { type CalendarEvent } from "@/components/calendar/EventDialog"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthHeaders(): Promise<HeadersInit> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token ?? ""}`,
    }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CalendarPage() {
    const { toast } = useToast()

    // ── Estado dos eventos
    const [events, setEvents] = useState<CalendarEvent[]>([])
    const [loading, setLoading] = useState(true)

    // ── Mês visível no calendário
    const [currentDate, setCurrentDate] = useState(new Date())
    const [currentView, setCurrentView] = useState<View>(Views.MONTH)

    // ── Dialog
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
    const [defaultDate, setDefaultDate] = useState<Date | null>(null)

    // ── Fetch eventos
    const fetchEvents = useCallback(async (date: Date) => {
        setLoading(true)
        try {
            const headers = await getAuthHeaders()
            // Se estiver em modo Semana/Dia, ainda buscamos o mês inteiro para simplificar e garantir cache
            const start = format(startOfMonth(date), "yyyy-MM-dd")
            const end = format(endOfMonth(date), "yyyy-MM-dd")
            const res = await fetch(
                apiUrl(`/api/events?start_date=${start}&end_date=${end}`),
                { headers }
            )
            if (!res.ok) throw new Error("Erro ao carregar eventos")
            const data: CalendarEvent[] = await res.json()
            setEvents(data)
        } catch (err: any) {
            toast({ title: "Erro", description: err.message, variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }, [toast])

    useEffect(() => {
        fetchEvents(currentDate)
    }, [currentDate, fetchEvents])

    // ── Navegar no calendário → busca eventos do novo mês
    function handleNavigate(date: Date) {
        setCurrentDate(date)
    }

    // ── Clicar em slot vazio → abre modal de criação
    function handleSelectSlot(slot: SlotInfo) {
        setSelectedEvent(null)
        setDefaultDate(slot.start as Date)
        setDialogOpen(true)
    }

    // ── Clicar em evento existente → abre modal de edição
    function handleSelectEvent(event: CalendarEvent) {
        setSelectedEvent(event)
        setDefaultDate(null)
        setDialogOpen(true)
    }

    // ── Botão "Novo Evento"
    function handleNewEvent() {
        setSelectedEvent(null)
        setDefaultDate(null)
        setDialogOpen(true)
    }

    // ── CRUD callbacks
    function handleCreated(event: CalendarEvent) {
        setEvents((prev) => [...prev, event])
    }

    function handleUpdated(updated: CalendarEvent) {
        setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    }

    function handleDeleted(id: string) {
        setEvents((prev) => prev.filter((e) => e.id !== id))
    }

    // ── render
    return (
        <div className="flex flex-col gap-6 p-6 h-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Agenda</h1>
                    <p className="text-muted-foreground mt-1">
                        {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase())}
                    </p>
                </div>
                <Button onClick={handleNewEvent} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Novo Evento
                </Button>
            </div>

            {/* Calendário */}
            <div className="flex-1 min-h-0">
                {loading ? (
                    <div className="flex items-center justify-center h-[560px] text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <CalendarView
                        events={events}
                        onSelectSlot={handleSelectSlot}
                        onSelectEvent={handleSelectEvent}
                        date={currentDate}
                        onNavigate={handleNavigate}
                        view={currentView}
                        onView={setCurrentView}
                    />
                )}
            </div>

            {/* Modal de evento */}
            <EventDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                event={selectedEvent}
                defaultDate={defaultDate}
                onCreated={handleCreated}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
            />
        </div>
    )
}
