"use client"

import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import { ApiError } from "@/lib/api/errors"
import { useMudarStatusDoProjeto } from "@/features/projects/hooks"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ProjectStatusSelectProps {
    projectId: string
    currentStatus: string
}

export function ProjectStatusSelect({ projectId, currentStatus }: ProjectStatusSelectProps) {
    const { toast } = useToast()
    const router = useRouter()
    const mudar = useMudarStatusDoProjeto()

    const handleStatusChange = async (novoStatus: string) => {
        try {
            await mudar.mutateAsync({ id: projectId, status: novoStatus })
            toast({ title: "Status Atualizado", description: "O status do projeto foi alterado com sucesso." })
            // Ver o comentario em ProjectWizard: Orcamento e Apresentacoes ainda
            // leem o cabecalho do servidor.
            router.refresh()
        } catch (erro) {
            if (erro instanceof ApiError && erro.status === 403) {
                toast({ variant: "destructive", title: "Limite de Plano", description: erro.message })
                return
            }
            toast({ variant: "destructive", title: "Ops!", description: "Não foi possível atualizar o status." })
        }
    }

    return (
        <div className="relative">
            {mudar.isPending && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/50">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                </div>
            )}
            <Select defaultValue={currentStatus} onValueChange={handleStatusChange} disabled={mudar.isPending}>
                <SelectTrigger className="h-9 w-[180px]" aria-label="Status do projeto">
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
