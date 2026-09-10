"use client"

import { Sparkles } from "lucide-react"

/** Banner de saudacao: cumprimento pela hora, nome do usuario e a data. */
export function GreetingBanner({ userName, currentDate }: { userName: string; currentDate: string }) {
    const getGreeting = () => {
        const hr = new Date().getHours()
        if (hr < 12) return "Bom dia"
        if (hr < 18) return "Boa tarde"
        return "Boa noite"
    }

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-primary/5 via-secondary/5 to-transparent p-6 rounded-2xl border border-primary/10">
            <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    {getGreeting()}, {userName} <Sparkles className="h-6 w-6 text-secondary animate-pulse" />
                </h1>
                <p className="text-muted-foreground mt-1.5 text-base md:text-lg">
                    Bem-vindo(a) de volta! Veja o que está acontecendo no seu escritório hoje.
                </p>
            </div>
            {currentDate && (
                <div className="text-sm font-medium text-muted-foreground bg-background px-4 py-2 rounded-full border shadow-sm self-start md:self-auto">
                    {currentDate}
                </div>
            )}
        </div>
    )
}
