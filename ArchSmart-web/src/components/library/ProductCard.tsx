"use client"

import { useState } from "react"
import { MoreHorizontal, Image as ImageIcon, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardFooter,
} from "@/components/ui/card"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
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
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api-url"

interface ProductCardProps {
    id: string
    name: string
    store?: string
    price?: number
    image_url?: string | null
    state?: string
    origin?: string
    dimensions?: any
    isInbox?: boolean
    onMove?: () => void
    onDelete?: () => void
}

export function ProductCard({
    id,
    name,
    store,
    price,
    image_url,
    state,
    origin,
    dimensions,
    isInbox,
}: ProductCardProps) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const { toast } = useToast()

    // State for Alert Dialog
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    // Formatter BRL
    const formatter = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    });

    const isMissingDimensions = isInbox && (!dimensions || !dimensions.width || !dimensions.height || !dimensions.depth);
    const actionType = isInbox ? "normalize" : "edit";

    const editUrl = {
        pathname: "/library",
        query: {
            ...Object.fromEntries(searchParams.entries()),
            action: actionType,
            id: id
        }
    }

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            const res = await fetch(apiUrl(`/api/products/${id}`), {
                method: "DELETE",
            })

            if (!res.ok) throw new Error("Erro ao excluir")

            toast({
                title: "Produto excluído",
                description: "O item foi movido para a lixeira.",
            })

            router.refresh()

        } catch (error) {
            console.error(error)
            toast({
                title: "Erro",
                description: "Não foi possível excluir o produto.",
                variant: "destructive"
            })
        } finally {
            setIsDeleting(false)
            setIsDeleteDialogOpen(false)
        }
    }

    const handleAddToProject = () => {
        toast({
            title: "Em breve",
            description: "Funcionalidade disponível em breve (Módulo de Projetos).",
        })
    }

    return (
        <>
            <Card className="overflow-hidden group hover:shadow-lg transition-shadow">
                <div className="aspect-square relative bg-muted flex items-center justify-center overflow-hidden">
                    {image_url ? (
                        <img
                            src={image_url}
                            alt={name}
                            className="object-cover w-full h-full transition-transform group-hover:scale-105"
                        />
                    ) : (
                        <ImageIcon className="h-10 w-10 text-muted-foreground" />
                    )}

                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="secondary" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Ações</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                    <Link href={editUrl}>{isInbox ? "Normalizar" : "Editar"}</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleAddToProject}>
                                    Mover para Projeto
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => setIsDeleteDialogOpen(true)}
                                    className="text-destructive focus:text-destructive"
                                >
                                    Excluir
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-2 mb-2">
                        {state && (
                            <Badge variant={state === "NORMALIZED" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0 h-5">
                                {state}
                            </Badge>
                        )}
                        {origin && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                                {origin}
                            </Badge>
                        )}
                        {isMissingDimensions && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                                Faltam Dimensões
                            </Badge>
                        )}
                    </div>
                    <h3 className="font-semibold leading-tight line-clamp-2 min-h-[2.5rem]" title={name}>
                        {name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                        {store || "Loja desconhecida"}
                    </p>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                    <span className="font-bold text-lg">
                        {price !== undefined && price !== null ? formatter.format(price) : "R$ --"}
                    </span>
                </CardFooter>
            </Card>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>
                            O item será excluído permanentemente. Essa ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                handleDelete()
                            }}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
