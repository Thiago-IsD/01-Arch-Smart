import { useState } from "react"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MoreVertical, Trash2, Edit2, Info } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/utils/supabase/client"
import { apiUrl } from "@/lib/api-url"

interface EnvironmentCardProps {
    environment: any
    onClick: () => void
    onDelete: (id: string) => void
}

export function EnvironmentCard({ environment, onClick, onDelete }: EnvironmentCardProps) {
    const { toast } = useToast()
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const isComplete = environment.dna?.is_complete

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsDeleteDialogOpen(true)
    }

    const confirmDelete = async () => {
        setIsDeleting(true)
        try {
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token || ""

            const res = await fetch(apiUrl(`/api/environments/${environment.id}`), {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            })

            if (!res.ok) throw new Error("Erro ao deletar ambiente")

            toast({ title: "Ambiente Excluído", description: "O ambiente foi removido com sucesso." })
            onDelete(environment.id)
        } catch (error) {
            toast({ variant: "destructive", title: "Ops!", description: "Erro ao excluir o ambiente." })
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <>
            <Card
                className="group hover:border-primary/50 transition-colors cursor-pointer pt-2 flex flex-col justify-between"
                onClick={onClick}
            >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 px-4 pt-4">
                    <div className="flex flex-col gap-1 w-[80%]">
                        <h4 className="font-semibold text-base line-clamp-1">{environment.name}</h4>
                        <span className="text-sm text-muted-foreground">{environment.type || "Geral"}</span>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity">
                                <span className="sr-only">Abrir menu</span>
                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={onClick} className="cursor-pointer">
                                <Edit2 className="mr-2 h-4 w-4" /> Configurar DNA
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive focus:text-destructive cursor-pointer">
                                <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardHeader>

                <CardContent className="px-4 pb-4 mt-2">
                    <div className="flex items-center space-x-2">
                        {isComplete ? (
                            <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800/50">
                                DNA Completo
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-amber-800 border-amber-300 bg-amber-100/50 dark:text-amber-300 dark:border-amber-800/60 dark:bg-amber-950/40">
                                <Info className="w-3 h-3 mr-1" />
                                DNA Pendente
                            </Badge>
                        )}
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Ambiente</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir o ambiente "{environment.name}" permanentemente? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={(e) => {
                            e.stopPropagation()
                            setIsDeleteDialogOpen(false)
                        }}>
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async (e) => {
                                e.stopPropagation()
                                setIsDeleteDialogOpen(false)
                                await confirmDelete()
                            }}
                            disabled={isDeleting}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
