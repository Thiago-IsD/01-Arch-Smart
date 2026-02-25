"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface ProjectStatusSelectProps {
    projectId: string
    currentStatus: string
}

export function ProjectStatusSelect({ projectId, currentStatus }: ProjectStatusSelectProps) {
    const [isUpdating, setIsUpdating] = useState(false)
    const { toast } = useToast()
    const router = useRouter()

    const handleStatusChange = async (newStatus: string) => {
        try {
            setIsUpdating(true)
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token || ""

            const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
            const res = await fetch(`${apiBase}/api/projects/${projectId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            })

            const responseData = await res.json()

            if (!res.ok) {
                if (res.status === 403) {
                    toast({
                        variant: "destructive",
                        title: "Limite de Plano",
                        description: responseData.detail || "Você atingiu o limite de projetos do seu plano.",
                    })
                    return
                }
                throw new Error("Erro ao atualizar status.")
            }

            toast({ title: "Status Atualizado", description: "O status do projeto foi alterado com sucesso." })
            router.refresh()
        } catch (error) {
            toast({ variant: "destructive", title: "Ops!", description: "Não foi possível atualizar o status." })
        } finally {
            setIsUpdating(false)
        }
    }

    return (
        <div className="relative">
            {isUpdating && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 rounded-md">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                </div>
            )}
            <Select defaultValue={currentStatus} onValueChange={handleStatusChange} disabled={isUpdating}>
                <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ACTIVE">Em Andamento (Ativo)</SelectItem>
                    <SelectItem value="COMPLETED">Concluído</SelectItem>
                    <SelectItem value="DRAFT">Rascunho</SelectItem>
                </SelectContent>
            </Select>
        </div>
    )
}
