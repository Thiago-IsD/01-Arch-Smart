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
import Link from "next/link"

interface UpgradeAlertModalProps {
    planLimit?: number
}

export function UpgradeAlertModal({ planLimit = 2 }: UpgradeAlertModalProps) {
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-amber-800 border-amber-300 bg-amber-100/50 hover:bg-amber-100 hover:text-amber-900">
                    <Lock className="mr-2 h-4 w-4" /> Slot Indisponível
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Limite de Projetos Atingido</AlertDialogTitle>
                    <AlertDialogDescription>
                        Desculpe, o seu plano atual permite manter até <strong>{planLimit}</strong> projeto(s) ativo(s) simultaneamente.
                        Para criar um novo projeto, conclua ou arquive um projeto existente.
                        <br /><br />
                        Ou faça o upgrade para o plano <strong>Professional</strong> e desbloqueie projetos ilimitados e novos recursos avançados.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Continuar no plano atual</AlertDialogCancel>
                    <AlertDialogAction asChild>
                        <Link href="/billing">Fazer Upgrade</Link>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
