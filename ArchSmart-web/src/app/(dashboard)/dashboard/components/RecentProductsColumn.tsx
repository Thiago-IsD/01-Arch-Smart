"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Package, Store } from "lucide-react"

import { Button } from "@/components/ui/button"

import { formatCurrency } from "./format"
import type { DashboardLean } from "@/features/dashboard/types"

/** Coluna 3 do grid secundario: "Adicoes na Biblioteca". */
export function RecentProductsColumn({ data }: { data: DashboardLean }) {
    const router = useRouter()

    return (
                <div className="lg:col-span-1 flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b pb-2">
                        <h2 className="text-xl font-bold tracking-tight text-foreground/90 flex items-center gap-2">
                            <Package className="h-5 w-5 text-primary" /> Adições na Biblioteca
                        </h2>
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 font-semibold p-0 h-auto" onClick={() => router.push("/library")}>
                            Ver Biblioteca
                        </Button>
                    </div>

                    {data.recent_products.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-dashed text-muted-foreground bg-muted/20">
                            <p className="text-sm font-medium">Nenhum produto salv recentemente.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {data.recent_products.map((prod) => (
                                <Link
                                    key={prod.id}
                                    href={`/library?product=${prod.id}`}
                                    className="group rounded-xl ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                                >
                                    <div className="flex flex-col rounded-xl border bg-card overflow-hidden hover:border-primary/40 transition-all duration-300 h-full">
                                        <div className="relative aspect-[4/3] w-full bg-muted border-b overflow-hidden">
                                            {prod.image_url ? (
                                                // `unoptimized`: a imagem vem da loja que o Web Clipper raspou, de qualquer
                                                // dominio da internet — nao da para declarar em `images.remotePatterns`, e sem
                                                // isso o otimizador recusa o dominio em tempo de execucao, sem erro de build.
                                                // Sem `sizes`: sem otimizacao nao ha srcset para escolher.
                                                <Image
                                                    src={prod.image_url}
                                                    alt={prod.name}
                                                    fill
                                                    unoptimized
                                                    className="object-cover transition-transform duration-500 group-hover:scale-105 group-focus-within:scale-105"
                                                />
                                            ) : (
                                                <div className="flex w-full h-full items-center justify-center bg-muted text-muted-foreground text-xs">
                                                    Sem imagem
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-2.5 flex flex-col justify-between flex-1 gap-1">
                                            <div>
                                                <p className="text-xs font-semibold text-foreground truncate pr-1 group-hover:text-primary group-focus-within:text-primary transition-colors">
                                                    {prod.name}
                                                </p>
                                                {prod.store && (
                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                                                        <Store className="h-2.5 w-2.5 shrink-0" />
                                                        {prod.store}
                                                    </span>
                                                )}
                                            </div>
                                            {prod.price !== undefined && prod.price !== null && prod.price > 0 && (
                                                <p className="text-xs font-bold text-foreground mt-1">
                                                    {formatCurrency(prod.price)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
    )
}
