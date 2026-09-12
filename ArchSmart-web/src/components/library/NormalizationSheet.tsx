"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useRouter } from "next/navigation"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { normalizeProduct } from "@/lib/normalize-product"
import { useApproveProduct } from "@/features/library/hooks"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { CATEGORIES, formSchema } from "./normalization-sheet-schema"
import { NormalizationProductPreview } from "./NormalizationProductPreview"
import { NormalizationDimensionFields } from "./NormalizationDimensionFields"

interface NormalizationSheetProps {
    isOpen: boolean
    productToNormalize?: any
}

export function NormalizationSheet({ isOpen, productToNormalize }: NormalizationSheetProps) {
    const router = useRouter()
    const { toast } = useToast()
    const aprovarProdutoMutation = useApproveProduct()
    const isSubmitting = aprovarProdutoMutation.isPending
    const [isExtracting, setIsExtracting] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            name: "",
            category: "",
            price: 0,
            width: 0,
            height: 0,
            depth: 0,
            yield_factor: undefined,
            source_url: "",
        },
    })

    useEffect(() => {
        if (productToNormalize) {
            form.reset({
                name: productToNormalize.name,
                category: productToNormalize.category || "",
                price: productToNormalize.price || 0,
                width: productToNormalize.dimensions?.width || 0,
                height: productToNormalize.dimensions?.height || 0,
                depth: productToNormalize.dimensions?.depth || 0,
                yield_factor: productToNormalize.yield_factor || undefined,
                source_url: productToNormalize.source_url || "",
            })
        }
    }, [productToNormalize, form])

    const onClose = () => {
        const url = new URL(window.location.href)
        url.searchParams.delete("action")
        url.searchParams.delete("id")
        router.push(url.pathname + url.search)
    }

    const { watch } = form
    const w = watch("width") || 0
    const h = watch("height") || 0
    const d = watch("depth") || 0
    const hasDimensions = w > 0 && h > 0 && d > 0

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (!hasDimensions) return

        try {
            const payload = {
                name: values.name,
                category: values.category,
                price: values.price,
                source_url: values.source_url,
                dimensions: {
                    width: values.width,
                    height: values.height,
                    depth: values.depth,
                    unit: "cm"
                },
                yield_factor: values.yield_factor || null
            }

            await aprovarProdutoMutation.mutateAsync({ id: productToNormalize.id, payload })

            toast({
                title: "Produto Aprovado!",
                description: "O item foi movido para a biblioteca.",
            })

            onClose()

        } catch (error) {
            console.error(error)
            toast({
                title: "Erro",
                description: error instanceof Error ? error.message : "Não foi possível aprovar o produto.",
                variant: "destructive",
            })
        }
    }

    const handleExtractAi = async () => {
        setIsExtracting(true)
        try {
            const currentUrl = form.getValues("source_url") || productToNormalize?.source_url || "";
            const currentName = form.getValues("name") || productToNormalize?.name || "";

            const data = await normalizeProduct({ text: currentName, source_url: currentUrl })

            if (data) {
                if (data.name) form.setValue("name", data.name)
                if (data.category) form.setValue("category", data.category)
                if (data.price !== undefined && data.price !== null) form.setValue("price", data.price)

                // A IA pode devolver dimensões parciais (ex.: sem profundidade). Sem o
                // fallback, setValue gravava undefined e apagava o que o usuário já digitou.
                if (data.dimensions) {
                    const { width, height, depth } = data.dimensions
                    if (width !== undefined && width !== null) form.setValue("width", width)
                    if (height !== undefined && height !== null) form.setValue("height", height)
                    if (depth !== undefined && depth !== null) form.setValue("depth", depth)
                }

                if (data.yield_factor !== undefined && data.yield_factor !== null) {
                    form.setValue("yield_factor", data.yield_factor)
                }

                toast({
                    title: data.source_blocked ? "Extração parcial" : "Sucesso",
                    description: data.source_blocked
                        ? "A loja bloqueou o acesso à página. Os dados vieram só do nome — confira antes de salvar."
                        : "Dados extraídos com IA.",
                })
            }

        } catch (error) {
            console.error(error)
            toast({
                title: "Erro",
                description: error instanceof Error ? error.message : "Não foi possível extrair os dados.",
                variant: "destructive"
            })
        } finally {
            setIsExtracting(false)
        }
    }

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="overflow-y-auto w-[400px] sm:w-[540px]">
                <SheetHeader className="mb-6">
                    <SheetTitle>Normalizar Produto</SheetTitle>
                    <SheetDescription>
                        Complete os dados faltantes para aprovar este produto.
                    </SheetDescription>
                </SheetHeader>

                {productToNormalize && (
                    <NormalizationProductPreview product={productToNormalize} />
                )}

                <div className="mb-6">
                    <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                        onClick={handleExtractAi}
                        disabled={isExtracting}
                    >
                        {isExtracting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        {isExtracting ? "Analisando..." : "Extrair dados com IA"}
                    </Button>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nome do Produto *</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="source_url"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>URL do Produto</FormLabel>
                                    <FormControl>
                                        <Input placeholder="https://..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="flex items-center gap-2 min-h-5">
                                            <FormLabel>Categoria</FormLabel>
                                        </div>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {CATEGORIES.map((cat) => (
                                                    <SelectItem key={cat} value={cat}>
                                                        {cat}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="price"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="flex items-center gap-2 min-h-5">
                                            <FormLabel>Preço (R$)</FormLabel>
                                            <TooltipProvider delayDuration={300}>
                                                <Tooltip>
                                                    <TooltipTrigger type="button" tabIndex={-1} className="cursor-help">
                                                        <Info className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-[250px] text-center">
                                                        <p>O sistema pode extrair preços promocionais (ex: PIX) dependendo da loja. <b>Sempre confira o valor!</b></p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                        <FormControl>
                                            <Input type="number" step="0.01" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <NormalizationDimensionFields control={form.control} hasDimensions={hasDimensions} />

                        <FormField
                            control={form.control}
                            name="yield_factor"
                            render={({ field }) => (
                                <FormItem className="pt-2">
                                    <div className="flex items-center gap-2">
                                        <FormLabel>Rendimento (Caixa / Unidade)</FormLabel>
                                        <TooltipProvider delayDuration={300}>
                                            <Tooltip>
                                                <TooltipTrigger type="button" tabIndex={-1} className="cursor-help">
                                                    <Info className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="max-w-[250px] text-center">
                                                    <p>Apenas números (Ex: 2.5). Usado para calcular a quantidade necessária no Orçamento de áreas.</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <FormControl>
                                        <Input type="number" step="0.01" placeholder="Ex: 2 m²" {...field} value={field.value ?? ""} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-2 pt-6 border-t mt-4">
                            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                            <Button type="submit" disabled={isSubmitting || !hasDimensions}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Aprovar Produto
                            </Button>
                        </div>

                    </form>
                </Form>
            </SheetContent>
        </Sheet>
    )
}
