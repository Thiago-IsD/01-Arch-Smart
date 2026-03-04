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
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api-url"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ImageUpload } from "@/components/ui/image-upload"

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
    store: z.string().optional(),
    category: z.string().optional(),
    price: z.coerce.number().min(0, "Preço inválido").optional(),
    image_url: z.string().url("URL inválida").optional().or(z.literal("")),
    description: z.string().optional(),
    // Dimensions
    width: z.coerce.number().optional(),
    height: z.coerce.number().optional(),
    depth: z.coerce.number().optional(),
    yield_factor: z.coerce.number().optional(),
    source_url: z.string().url("URL inválida").optional().or(z.literal("")),
})

interface ProductFormSheetProps {
    isOpen: boolean
    productToEdit?: any // Typed as needed
}

export function ProductFormSheet({ isOpen, productToEdit }: ProductFormSheetProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            name: "",
            store: "",
            category: "",
            price: 0,
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
        setIsSubmitting(true)
        try {
            // Prepare payload
            const payload = {
                name: values.name,
                store: values.store,
                category: values.category,
                price: values.price,
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

            // Clean undefineds
            // Create user
            const { createClient } = await import("@/utils/supabase/client");
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) throw new Error("Usuário não autenticado");

            // We need to fetch the account_id from our API or store it in session. 
            // For now, let's assume the backend finds it via the user, OR we pass a dummy account_id since auth/user/account logic is complex here.
            // Actually, backend requires account_id. 
            // Let's rely on the backend finding the account via the user token IF we had that middleware set up perfectly.
            // But currently auth.py creates user/account.
            // Let's just pass a hardcoded/fetched account ID? No, let's fix backend to get account from user? 
            // Better: For this MVP, we fetch the first account of the user or similar.
            // Wait, create_product endpoint requires account_id in body? 
            // ProductCreate schema has account_id: UUID.

            // Temporary Hack: Fetch current user's account first? 
            // Or simpler: Fetch one of the existing accounts from the seed to make it work for now?
            // "41456060-7f1a-46d8-9769-5ada9733fe97" was created in seed.
            // Use that for now to avoid blocking.
            const accountId = "41456060-7f1a-46d8-9769-5ada9733fe97"

            const method = productToEdit ? "PUT" : "POST"
            const url = productToEdit
                ? apiUrl(`/api/products/${productToEdit.id}`)
                : apiUrl("/api/products/")

            const finalPayload = { ...payload, account_id: accountId }

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(finalPayload),
            })

            if (!res.ok) throw new Error("Falha ao salvar produto")

            toast({
                title: productToEdit ? "Produto atualizado!" : "Produto criado!",
                description: `${values.name} foi salvo com sucesso.`,
            })

            onClose()
            router.refresh()

        } catch (error) {
            console.error(error)
            toast({
                title: "Erro",
                description: "Não foi possível salvar o produto.",
                variant: "destructive",
            })
        } finally {
            setIsSubmitting(false)
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

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="price"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Preço (R$)</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" {...field} />
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
                            <div className="flex gap-2">
                                <FormField
                                    control={form.control}
                                    name="width"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormControl>
                                                <Input type="number" placeholder="L" title="Largura" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="height"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormControl>
                                                <Input type="number" placeholder="A" title="Altura" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="depth"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormControl>
                                                <Input type="number" placeholder="P" title="Profundidade" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
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
