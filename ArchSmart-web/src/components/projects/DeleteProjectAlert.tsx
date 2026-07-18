"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Trash2 } from "lucide-react"
import { apiUrl } from "@/lib/api-url"
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface DeleteProjectAlertProps {
    projectId: string
    projectName: string
}

export function DeleteProjectAlert({ projectId, projectName }: DeleteProjectAlertProps) {
    const [confirmName, setConfirmName] = useState("")
    const [isDeleting, setIsDeleting] = useState(false)
    const { toast } = useToast()
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false)

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault()

        if (confirmName !== projectName) return

        try {
            setIsDeleting(true)
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token || ""

            const res = await fetch(apiUrl(`/api/projects/${projectId}`), {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            })

            if (!res.ok) throw new Error("Erro ao excluir o projeto.")

            toast({ title: "Projeto Excluído", description: "O projeto e todos os seus ambientes foram excluídos com sucesso." })
            setIsOpen(false)
            router.push("/projects")
            router.refresh()
        } catch (error) {
            toast({ variant: "destructive", title: "Ops!", description: "Não foi possível excluir o projeto." })
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
            <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300 hidden md:flex">
                    <Trash2 className="w-4 h-4 mr-2" /> Excluir
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Isso excluirá permanentemente o projeto <strong>{projectName}</strong> e removerá todos os dados de orçamento, apresentação e ambientes associados do banco de dados.
                        <br /><br />
                        Para confirmar, digite o nome do projeto (exatamente como escrito acima):
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="my-2">
                    <Input
                        placeholder={projectName}
                        value={confirmName}
                        onChange={(e) => setConfirmName(e.target.value)}
                        className="w-full"
                    />
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setConfirmName("")}>Cancelar</AlertDialogCancel>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={confirmName !== projectName || isDeleting}
                    >
                        {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                        Excluir Projeto Permanentemente
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
