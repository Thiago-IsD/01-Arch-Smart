"use client"

import { useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Upload, X, Image as ImageIcon, Link as LinkIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface ImageUploadProps {
    value: string
    onChange: (url: string) => void
    disabled?: boolean
}

export function ImageUpload({ value, onChange, disabled }: ImageUploadProps) {
    const [isUploading, setIsUploading] = useState(false)
    const supabase = createClient()

    const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random()}.${fileExt}`
            const filePath = `products/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('public-assets')
                .upload(filePath, file)

            if (uploadError) {
                throw uploadError
            }

            const { data } = supabase.storage
                .from('public-assets')
                .getPublicUrl(filePath)

            onChange(data.publicUrl)
        } catch (error) {
            console.error("Upload failed:", error)
            alert("Erro ao fazer upload da imagem.")
        } finally {
            setIsUploading(false)
        }
    }

    const onRemove = () => {
        onChange("")
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-4">
                {value ? (
                    <div className="relative w-40 h-40 rounded-md overflow-hidden border">
                        <img
                            src={value}
                            alt="Product Image"
                            className="object-cover w-full h-full"
                        />
                        <button
                            onClick={onRemove}
                            className="absolute top-1 right-1 bg-destructive text-white p-1 rounded-full shadow-sm hover:bg-destructive/90 transition"
                            type="button"
                            disabled={disabled}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                ) : (
                    <div className="w-40 h-40 rounded-md border border-dashed flex flex-col items-center justify-center text-muted-foreground bg-muted/50">
                        <ImageIcon className="h-10 w-10 mb-2 opacity-50" />
                        <span className="text-xs">Sem imagem</span>
                    </div>
                )}

                <div className="flex flex-col gap-2 w-full mt-2">
                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={disabled || isUploading}
                            className="w-full sm:w-auto"
                            asChild
                        >
                            <label className="cursor-pointer">
                                {isUploading ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <Upload className="h-4 w-4 mr-2" />
                                )}
                                Carregar Arquivo
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={onUpload}
                                    disabled={disabled || isUploading}
                                />
                            </label>
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={disabled || isUploading}
                            className="w-full sm:w-auto"
                            onClick={() => {
                                const input = prompt("Ou cole uma URL externa da imagem:", value || "")
                                if (input !== null) onChange(input)
                            }}
                        >
                            <LinkIcon className="h-4 w-4 mr-2" />
                            Editar URL
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Formatos: JPG, PNG, WEBP. Máx 5MB.
                    </p>
                </div>
            </div>
        </div>
    )
}
