import { MoreHorizontal, Image as ImageIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
} from "@/components/ui/card"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ProductCardProps {
    name: string
    store?: string
    price?: number
    image_url?: string | null
    state?: string
    origin?: string
    onEdit?: () => void
    onMove?: () => void
    onDelete?: () => void
}

export function ProductCard({
    name,
    store,
    price,
    image_url,
    state,
    origin,
    onEdit,
    onMove,
    onDelete,
}: ProductCardProps) {

    // Formatter BRL
    const formatter = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    });

    return (
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
                            <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>
                            <DropdownMenuItem onClick={onMove}>Mover para Projeto</DropdownMenuItem>
                            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                                Excluir
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <CardContent className="p-4">
                <div className="flex gap-2 mb-2">
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
    )
}
