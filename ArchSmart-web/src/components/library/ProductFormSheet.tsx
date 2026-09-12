"use client"

import { useEffect } from "react"
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
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useCreateProduct, useUpdateProduct } from "@/features/library/hooks"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ImageUpload } from "@/components/ui/image-upload"
import { CATEGORIES, formSchema } from "./product-form-schema"
import { ProductDimensionFields } from "./ProductDimensionFields"

interface ProductFormSheetProps {
    isOpen: boolean
    productToEdit?: any // Typed as needed
}

export function ProductFormSheet({ isOpen, productToEdit }: ProductFormSheetProps) {
    const router = useRouter()
    const { toast } = useToast()
    const criarProdutoMutation = useCreateProduct()
    const atualizarProdutoMutation = useUpdateProduct()
    const isSubmitting = criarProdutoMutation.isPending || atualizarProdutoMutation.isPending

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            name: "",
            store: "",
            category: "",
            price: 0,
            cost_price: 0,
            markup: 0,
            image_url: "",
            description: "",
            width: 0,
            height: 0,
            depth: 0,
            yield_factor: undefined,
            source_url: "",
        },
    })

    // Update form when productToEdit changes
    useEffect(() => {
        if (productToEdit) {
            form.reset({
                name: productToEdit.name,
                store: productToEdit.store || "",
                category: productToEdit.category || "",
                price: productToEdit.price || 0,
                cost_price: productToEdit.cost_price || 0,
                markup: productToEdit.markup || 0,
                image_url: productToEdit.image_url || "",
                description: productToEdit.description || "",
                width: productToEdit.dimensions?.width || 0,
                height: productToEdit.dimensions?.height || 0,
                depth: productToEdit.dimensions?.depth || 0,
                yield_factor: productToEdit.yield_factor || undefined,
                source_url: productToEdit.source_url || "",
            })
        } else {
            form.reset({
                name: "",
                store: "",
                category: "",
                price: 0,
                cost_price: 0,
                markup: 0,
                image_url: "",
                description: "",
                width: 0,
                height: 0,
                depth: 0,
                yield_factor: undefined,
                source_url: "",
            })
        }
    }, [productToEdit, form])

    const onClose = () => {
        // Remove params to close sheet
        const url = new URL(window.location.href)
        url.searchParams.delete("action")
        url.searchParams.delete("id")
        router.push(url.pathname + url.search)
    }

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            const payload = {
                name: values.name,
                store: values.store,
                category: values.category,
                price: values.price,
                cost_price: values.cost_price,
                markup: values.markup,
                image_url: values.image_url || null,
                description: values.description,
                source_url: values.source_url || null,
                dimensions: {
                    width: values.width,
                    height: values.height,
                    depth: values.depth,
                    unit: "cm"
                },
                yield_factor: values.yield_factor || null
            }

            if (productToEdit) {
                await atualizarProdutoMutation.mutateAsync({ id: productToEdit.id, payload })
            } else {
                await criarProdutoMutation.mutateAsync(payload)
            }

            toast({
                title: productToEdit ? "Produto atualizado!" : "Produto criado!",
                description: `${values.name} foi salvo com sucesso.`,
            })

            onClose()

        } catch (error) {
            console.error(error)
            toast({
                title: "Erro",
                description: error instanceof Error ? error.message : "Não foi possível salvar o produto.",
                variant: "destructive",
            })
        }
    }

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="overflow-y-auto w-[400px] sm:w-[540px]">
                <SheetHeader>
                    <SheetTitle>{productToEdit ? "Editar Produto" : "Novo Produto"}</SheetTitle>
                    <SheetDescription>
                        Preencha os dados abaixo para salvar o produto na sua biblioteca.
                    </SheetDescription>
                </SheetHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">

                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nome do Produto *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Cadeira Eames..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="store"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Marca / Loja</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Herman Miller" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />


                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Categoria</FormLabel>
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
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <FormField
                                control={form.control}
                                name="cost_price"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Custo (R$)</FormLabel>
                                        <FormControl>
                                            <Input 
                                                type="number" 
                                                step="0.01" 
                                                {...field} 
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    field.onChange(val);
                                                    const currentMarkup = form.getValues("markup") || 0;
                                                    const sellingPrice = val * (1 + currentMarkup / 100);
                                                    form.setValue("price", parseFloat(sellingPrice.toFixed(2)));
                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="markup"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Markup (%)</FormLabel>
                                        <FormControl>
                                            <Input 
                                                type="number" 
                                                step="0.1" 
                                                {...field} 
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    field.onChange(val);
                                                    const cost = form.getValues("cost_price") || 0;
                                                    const sellingPrice = cost * (1 + val / 100);
                                                    form.setValue("price", parseFloat(sellingPrice.toFixed(2)));
                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="price"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Venda (R$)</FormLabel>
                                        <FormControl>
                                            <Input 
                                                type="number" 
                                                step="0.01" 
                                                {...field} 
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    field.onChange(val);
                                                    const cost = form.getValues("cost_price") || 0;
                                                    if (cost > 0) {
                                                        const calculatedMarkup = ((val / cost) - 1) * 100;
                                                        form.setValue("markup", parseFloat(calculatedMarkup.toFixed(2)));
                                                    }
                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

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

                        <FormField
                            control={form.control}
                            name="image_url"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Imagem do Produto</FormLabel>
                                    <FormControl>
                                        <ImageUpload
                                            value={field.value || ""}
                                            onChange={field.onChange}
                                            disabled={isSubmitting}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Dimensões (cm)</label>
                            <ProductDimensionFields control={form.control} />
                        </div>

                        <FormField
                            control={form.control}
                            name="yield_factor"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Rendimento da Caixa / Unidade (ex: m², ml)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" placeholder="Ex: 2.5" {...field} value={field.value ?? ""} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descrição</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Detalhes opcionais..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar
                            </Button>
                        </div>

                    </form>
                </Form>
            </SheetContent>
        </Sheet>
    )
}
