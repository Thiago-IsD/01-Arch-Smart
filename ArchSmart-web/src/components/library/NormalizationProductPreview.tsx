"use client"

import { ExternalLink } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"

interface NormalizationProductPreviewProps {
    product: {
        image_url?: string | null
        name: string
        store?: string | null
        source_url?: string | null
    }
}

// Resumo do produto sendo normalizado: imagem, nome, loja e link para a
// página de origem. Extraído de NormalizationSheet.tsx sem mudança de JSX.
export function NormalizationProductPreview({ product }: NormalizationProductPreviewProps) {
    return (
        <div className="flex gap-4 mb-6 p-4 border rounded-lg bg-muted/50">
            {product.image_url ? (
                // `unoptimized`: a imagem vem da loja raspada pelo Web Clipper, de dominio
                // arbitrario, que nao da para declarar em `images.remotePatterns`. Ver o
                // comentario no ProductCard.
                <Image
                    src={product.image_url}
                    alt={product.name}
                    width={96}
                    height={96}
                    unoptimized
                    className="w-24 h-24 object-cover rounded-md"
                />
            ) : (
                <div className="w-24 h-24 bg-muted rounded-md flex items-center justify-center">
                    Sem imagem
                </div>
            )}
            <div className="flex flex-col flex-1 justify-center">
                <h4 className="font-medium text-sm line-clamp-2">{product.name}</h4>
                <p className="text-sm text-muted-foreground mt-1">{product.store}</p>

                <Button variant="link" className="p-0 h-auto self-start mt-2" size="sm" asChild>
                    {product.source_url ? (
                        <a href={product.source_url} target="_blank" rel="noopener noreferrer">
                            Ver na Loja <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                    ) : (
                        <span className="text-muted-foreground">URL não disponível</span>
                    )}
                </Button>
            </div>
        </div>
    )
}
