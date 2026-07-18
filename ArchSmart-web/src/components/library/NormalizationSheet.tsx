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
import { Loader2, Sparkles, ExternalLink, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api-url"
import { createClient } from "@/utils/supabase/client"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

async function getToken(): Promise<string | undefined> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
}
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

const CATEGORIES = [
    "Mobiliário",
    "Iluminação",
    "Decoração",
    "Revestimentos",
    "Marcenaria",
    "Paisagismo",
    "Outros"
]

const formSchema = z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    category: z.string().optional(),
    price: z.coerce.number().min(0, "Preço inválido").optional(),
    width: z.coerce.number().optional(),
    height: z.coerce.number().optional(),
    depth: z.coerce.number().optional(),
    yield_factor: z.coerce.number().optional(),
    source_url: z.string().url("URL inválida").optional().or(z.literal("")),
})

interface NormalizationSheetProps {
    isOpen: boolean
    productToNormalize?: any
}

export function NormalizationSheet({ isOpen, productToNormalize }: NormalizationSheetProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [isSubmitting, setIsSubmitting] = useState(false)
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

        setIsSubmitting(true)
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

            const token = await getToken()
            const res = await fetch(apiUrl(`/api/products/${productToNormalize.id}/approve`), {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(payload),
            })

            if (!res.ok) throw new Error("Falha ao aprovar produto")

            toast({
                title: "Produto Aprovado!",
                description: "O item foi movido para a biblioteca.",
            })

            onClose()
            router.refresh()

        } catch (error) {
            console.error(error)
            toast({
                title: "Erro",
                description: "Não foi possível aprovar o produto.",
                variant: "destructive",
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleExtractAi = async () => {
        setIsExtracting(true)
        try {
            const currentUrl = form.getValues("source_url") || productToNormalize?.source_url || "";
            const currentName = form.getValues("name") || productToNormalize?.name || "";

            const token = await getToken()
            const res = await fetch(apiUrl("/api/products/normalize"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ text: currentName, source_url: currentUrl }),
            })

            if (!res.ok) throw new Error("Falha ao extrair dados")

            const data = await res.json()

            if (data) {
                if (data.name) form.setValue("name", data.name)
                if (data.category) form.setValue("category", data.category)
                if (data.price !== undefined && data.price !== null) form.setValue("price", data.price)

                if (data.dimensions) {
                    form.setValue("width", data.dimensions.width)
                    form.setValue("height", data.dimensions.height)
                    form.setValue("depth", data.dimensions.depth)
                }

                if (data.yield_factor !== undefined && data.yield_factor !== null) {
                    form.setValue("yield_factor", data.yield_factor)
                }

                toast({
                    title: "Sucesso",
                    description: "Dados extraídos com IA.",
                })
            }

        } catch (error) {
            console.error(error)
            toast({
                title: "Erro",
                description: "Não foi possível conectar com a IA.",
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
                    <div className="flex gap-4 mb-6 p-4 border rounded-lg bg-muted/50">
                        {productToNormalize.image_url ? (
                            <img
                                src={productToNormalize.image_url}
                                alt={productToNormalize.name}
                                className="w-24 h-24 object-cover rounded-md"
                            />
                        ) : (
                            <div className="w-24 h-24 bg-muted rounded-md flex items-center justify-center">
                                Sem imagem
                            </div>
                        )}
                        <div className="flex flex-col flex-1 justify-center">
                            <h4 className="font-medium text-sm line-clamp-2">{productToNormalize.name}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{productToNormalize.store}</p>

                            <Button variant="link" className="p-0 h-auto self-start mt-2" size="sm" asChild>
                                {productToNormalize.source_url ? (
                                    <a href={productToNormalize.source_url} target="_blank" rel="noopener noreferrer">
                                        Ver na Loja <ExternalLink className="ml-1 h-3 w-3" />
                                    </a>
                                ) : (
                                    <span className="text-muted-foreground">URL não disponível</span>
                                )}
                            </Button>
                        </div>
                    </div>
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

                        <div className="space-y-3">
                            <label className="text-sm font-medium leading-none">
                                Dimensões: Largura x Altura x Prof. (cm) {!hasDimensions && <span className="text-destructive">*</span>}
                            </label>
                            <div className="flex gap-2">
                                <FormField
                                    control={form.control}
                                    name="width"
                                    render={({ field }) => (
                                        <FormItem className="flex-1 space-y-1">
                                            <FormControl>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground w-4 text-center">L</span>
                                                    <Input type="number" step="0.1" className="pl-8" placeholder="0" title="Largura em cm" {...field} />
                                                </div>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="height"
                                    render={({ field }) => (
                                        <FormItem className="flex-1 space-y-1">
                                            <FormControl>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground w-4 text-center">A</span>
                                                    <Input type="number" step="0.1" className="pl-8" placeholder="0" title="Altura em cm" {...field} />
                                                </div>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="depth"
                                    render={({ field }) => (
                                        <FormItem className="flex-1 space-y-1">
                                            <FormControl>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground w-4 text-center">P</span>
                                                    <Input type="number" step="0.1" className="pl-8" placeholder="0" title="Profundidade em cm" {...field} />
                                                </div>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            {!hasDimensions && (
                                <p className="text-[0.8rem] text-destructive font-medium">As dimensões são obrigatórias para aprovação.</p>
                            )}
                        </div>

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
