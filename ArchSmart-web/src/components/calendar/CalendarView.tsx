"use client"

import { useMemo } from "react"
import { Calendar, dateFnsLocalizer, SlotInfo, Views, View } from "react-big-calendar"
import { format, parse, startOfWeek, getDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { CalendarEvent } from "./EventDialog"

import "react-big-calendar/lib/css/react-big-calendar.css"
import "./calendar.css"

// ---------------------------------------------------------------------------
// Localizer com date-fns + pt-BR
// ---------------------------------------------------------------------------

const locales = { "pt-BR": ptBR }

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 0 }),
    getDay,
    locales,
})

// ---------------------------------------------------------------------------
// Mapeamento de mensagens/labels para pt-BR
// ---------------------------------------------------------------------------

const messages = {
    allDay: "Dia inteiro",
    previous: "‹",
    next: "›",
    today: "Hoje",
    month: "Mês",
    week: "Semana",
    day: "Dia",
    date: "Data",
    time: "Hora",
    event: "Evento",
    noEventsInRange: "Nenhum evento neste período.",
    showMore: (total: number) => `+${total} mais`,
}

// ---------------------------------------------------------------------------
// Tipo interno do RBC
// ---------------------------------------------------------------------------

interface RBCEvent {
    id: string
    title: string
    start: Date
    end: Date
    resource: CalendarEvent
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CalendarViewProps {
    events: CalendarEvent[]
    onSelectSlot: (slot: SlotInfo) => void
    onSelectEvent: (event: CalendarEvent) => void
    date?: Date
    onNavigate?: (date: Date) => void
    view?: View
    onView?: (view: View) => void
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function CalendarView({
    events,
    onSelectSlot,
    onSelectEvent,
    date,
    onNavigate,
    view,
    onView,
}: CalendarViewProps) {
    // Converte eventos da API para o formato do RBC
    const rbcEvents: RBCEvent[] = useMemo(() => {
        return events.map((ev) => ({
            id: ev.id,
            title: ev.project_name ? `${ev.title} · ${ev.project_name}` : ev.title,
            start: new Date(ev.start_time),
            end: new Date(ev.end_time),
            resource: ev,
        }))
    }, [events])

    function handleSelectEvent(rbcEvent: RBCEvent) {
        onSelectEvent(rbcEvent.resource)
    }

    return (
        <div className="rbc-wrapper h-full">
            <Calendar
                localizer={localizer}
                events={rbcEvents}
                startAccessor="start"
                endAccessor="end"
                style={{ height: "100%", minHeight: 560 }}
                messages={messages}
                culture="pt-BR"
                view={view}
                onView={onView}
                views={[Views.MONTH, Views.WEEK, Views.DAY]}
                selectable
                onSelectSlot={onSelectSlot}
                onSelectEvent={handleSelectEvent}
                date={date}
                onNavigate={onNavigate}
                popup
                tooltipAccessor={(e: RBCEvent) => e.title}
            />
        </div>
    )
}
