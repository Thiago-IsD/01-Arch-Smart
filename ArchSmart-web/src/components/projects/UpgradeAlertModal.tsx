"use client"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Lock } from "lucide-react"

export function UpgradeAlertModal() {
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100 hover:text-amber-700">
                    <Lock className="mr-2 h-4 w-4" /> Slot Indisponível
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Limite de Projetos Atingido</AlertDialogTitle>
                    <AlertDialogDescription>
                        Desculpe, o plano Solo permite manter até 2 projetos ativos simultaneamente.
                        Para criar um novo projeto, conclua ou arquive um projeto existente.
                        <br /><br />
                        Ou faça o upgrade para o plano <strong>Professional</strong> e desbloqueie projetos ilimitados e novos recursos avançados.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Continuar no Solo</AlertDialogCancel>
                    <AlertDialogAction asChild>
                        <a href="/billing">Fazer Upgrade</a>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
