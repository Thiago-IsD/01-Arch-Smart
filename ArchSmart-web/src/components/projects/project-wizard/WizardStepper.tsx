"use client"

import { Check, PenTool, User, Wallet } from "lucide-react"

/** Cabecalho de progresso das tres etapas. */
export function WizardStepper({ step }: { step: number }) {
// Step indicators UI
const steps = [
    { num: 1, label: "Projeto", icon: PenTool },
    { num: 2, label: "Cliente", icon: User },
    { num: 3, label: "Financeiro", icon: Wallet }
]

    return (
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
    )
}
