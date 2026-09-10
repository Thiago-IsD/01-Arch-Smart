"use client"

import { useRouter } from "next/navigation"
import { Calendar, Video } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import type { DashboardLeanResponse } from "./types"

/** Coluna 2 do grid secundario: "Proximos Compromissos". */
export function UpcomingEventsColumn({ data }: { data: DashboardLeanResponse | null }) {
    const router = useRouter()

    return (
                <div className="lg:col-span-1 flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b pb-2">
                        <h2 className="text-xl font-bold tracking-tight text-foreground/90 flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-secondary" /> Próximos Compromissos
                        </h2>
                        <Button variant="ghost" size="sm" className="text-secondary hover:text-secondary/80 font-semibold p-0 h-auto" onClick={() => router.push("/calendar")}>
                            Agenda Completa
                        </Button>
                    </div>

                    {!data?.upcoming_events || data.upcoming_events.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-dashed text-muted-foreground bg-muted/20">
                            <Calendar className="h-10 w-10 mb-3 text-muted-foreground/40" />
                            <p className="text-sm font-medium mb-3">Nenhum compromisso para os próximos dias.</p>
                            <Button size="sm" variant="outline" className="border-secondary/20 text-secondary hover:bg-secondary/5 hover:border-secondary/50" onClick={() => router.push("/calendar")}>
                                Agendar Reunião
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {data.upcoming_events.map((event) => {
                                const start = new Date(event.start_time)
                                const timeFormatted = format(start, "HH:mm")
                                const dateFormatted = format(start, "dd 'de' MMM", { locale: ptBR })

                                return (
                                    <Card key={event.id} className="hover:border-secondary/30 transition-all duration-300 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-secondary/50" />
                                        <CardContent className="p-4 flex flex-col gap-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <h3 className="font-semibold text-foreground text-sm line-clamp-1">{event.title}</h3>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {dateFormatted} às {timeFormatted}
                                                    </p>
                                                </div>
                                                {event.meet_link && (
                                                    <Button 
                                                        size="sm" 
                                                        className="h-7 px-3 bg-secondary hover:bg-secondary/90 text-secondary-foreground text-xs gap-1 rounded-full shrink-0"
                                                        onClick={(e) => {
                                                            e.preventDefault()
                                                            window.open(event.meet_link, "_blank")
                                                        }}
                                                    >
                                                        <Video className="h-3 w-3" />
                                                        Entrar
                                                    </Button>
                                                )}
                                            </div>
                                            {event.project_name && (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <Badge variant="outline" className="text-[10px] py-0.5 px-2 font-medium bg-muted/50 border-muted">
                                                        Projeto: {event.project_name}
                                                    </Badge>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </div>
    )
}
