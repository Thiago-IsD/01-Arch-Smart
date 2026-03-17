"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, Trash2, ShieldAlert, Check, Eye, EyeOff, Calendar, Plug } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from "@/components/ui/card"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { apiUrl } from "@/lib/api-url"
import { Input } from "@/components/ui/input"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
// Assuming api utility exists, if not I'll use fetch directly or axios
// I will use fetch for simplicity to avoid import errors if api path is unknown
// But standard request:
import { useRouter } from "next/navigation"

// --- Schemas ---

const passwordSchema = z.object({
    currentPassword: z.string().min(1, "Senha atual é obrigatória"),
    newPassword: z.string()
        .min(8, "A senha deve ter no mínimo 8 caracteres")
        .regex(/[A-Z]/, "Deve conter pelo menos uma letra maiúscula")
        .regex(/[a-z]/, "Deve conter pelo menos uma letra minúscula")
        .regex(/[0-9]/, "Deve conter pelo menos um número")
        .regex(/[^A-Za-z0-9]/, "Deve conter pelo menos um caractere especial"),
    confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
})

type PasswordFormValues = z.infer<typeof passwordSchema>

export default function SettingsPage() {
    const { toast } = useToast()
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    // Form for Change Password
    const form = useForm<PasswordFormValues>({
        resolver: zodResolver(passwordSchema),
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        },
    })

    async function onPasswordSubmit(data: PasswordFormValues) {
        setIsLoading(true)
        try {
            // Get token from Supabase session
            const { createClient } = await import("@/utils/supabase/client")
            const supabase = createClient()
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()

            if (sessionError || !session) {
                throw new Error("Sessão expirada. Faça login novamente.")
            }

            const response = await fetch(apiUrl("/api/auth/change-password"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    current_password: data.currentPassword,
                    new_password: data.newPassword
                })
            })

            if (!response.ok) {
                let errorMessage = "Erro ao alterar senha"
                try {
                    const errorData = await response.json()
                    errorMessage = errorData.detail || errorMessage
                } catch (e) { }
                throw new Error(errorMessage)
            }

            toast({
                title: "Sucesso",
                description: "Senha alterada com sucesso.",
                variant: "default", // or success if available
            })

            form.reset()

        } catch (error: any) {
            toast({
                title: "Erro",
                description: error.message,
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    async function onDeleteAccount() {
        setIsDeleting(true)
        try {
            // Get token from Supabase session
            const { createClient } = await import("@/utils/supabase/client")
            const supabase = createClient()
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()

            if (sessionError || !session) {
                throw new Error("Sessão expirada. Faça login novamente.")
            }

            const response = await fetch(apiUrl("/api/account"), {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${session.access_token}`
                }
            })

            if (!response.ok) {
                throw new Error("Falha ao excluir conta")
            }

            toast({
                title: "Conta excluída",
                description: "Sua conta foi desativada. Redirecionando...",
            })

            // Sign out from Supabase and redirect
            await supabase.auth.signOut()

            setTimeout(() => {
                router.push("/auth/login")
            }, 2000)

        } catch (error: any) {
            toast({
                title: "Erro",
                description: error.message,
                variant: "destructive",
            })
            setIsDeleting(false)
        }
    }

    // Visual toggles
    const [showCurrent, setShowCurrent] = useState(false)
    const [showNew, setShowNew] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    // Password Rules Logic
    const newPasswordValue = form.watch("newPassword") || ""
    const confirmPasswordValue = form.watch("confirmPassword") || ""

    const requirements = [
        { label: "Mínimo 8 caracteres", test: (p: string) => p.length >= 8 },
        { label: "Letra Maiúscula", test: (p: string) => /[A-Z]/.test(p) },
        { label: "Letra Minúscula", test: (p: string) => /[a-z]/.test(p) },
        { label: "Número", test: (p: string) => /[0-9]/.test(p) },
        { label: "Caractere Especial", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
    ]

    return (
        <div className="container mx-auto py-10 space-y-8 max-w-3xl">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
                <p className="text-muted-foreground">
                    Gerencie suas preferências de segurança e conta.
                </p>
            </div>

            {/* Seção 1: Alterar Senha */}
            <Card>
                <CardHeader>
                    <CardTitle>Segurança</CardTitle>
                    <CardDescription>
                        Atualize sua senha para manter sua conta segura.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onPasswordSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="currentPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Senha Atual</FormLabel>
                                        <div className="relative">
                                            <FormControl>
                                                <Input
                                                    type={showCurrent ? "text" : "password"}
                                                    placeholder="••••••••"
                                                    {...field}
                                                    className="pr-10"
                                                />
                                            </FormControl>
                                            <button
                                                type="button"
                                                onClick={() => setShowCurrent(!showCurrent)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                                tabIndex={-1}
                                            >
                                                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="grid gap-4 md:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="newPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nova Senha</FormLabel>
                                            <div className="relative">
                                                <FormControl>
                                                    <Input
                                                        type={showNew ? "text" : "password"}
                                                        placeholder="••••••••"
                                                        {...field}
                                                        className="pr-10"
                                                    />
                                                </FormControl>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowNew(!showNew)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                                    tabIndex={-1}
                                                >
                                                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="confirmPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Confirmar Nova Senha</FormLabel>
                                            <div className="relative">
                                                <FormControl>
                                                    <Input
                                                        type={showConfirm ? "text" : "password"}
                                                        placeholder="••••••••"
                                                        {...field}
                                                        className="pr-10"
                                                    />
                                                </FormControl>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirm(!showConfirm)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                                    tabIndex={-1}
                                                >
                                                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Visual Password Rules */}
                            <div className="rounded-lg border bg-card p-4 text-sm shadow-sm space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {requirements.map((req, idx) => {
                                        const isValid = req.test(newPasswordValue);
                                        return (
                                            <div key={idx} className="flex items-center gap-2">
                                                {isValid ? (
                                                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                                                ) : (
                                                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 shrink-0 ml-1.5 mr-1" />
                                                )}
                                                <span className={`${isValid ? "text-foreground" : "text-muted-foreground"} text-xs transition-colors`}>
                                                    {req.label}
                                                </span>
                                            </div>
                                        )
                                    })}
                                    {/* Confirm Password Check */}
                                    <div className="flex items-center gap-2">
                                        {confirmPasswordValue && newPasswordValue === confirmPasswordValue ? (
                                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                                        ) : (
                                            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 shrink-0 ml-1.5 mr-1" />
                                        )}
                                        <span className={`${confirmPasswordValue && newPasswordValue === confirmPasswordValue ? "text-foreground" : "text-muted-foreground"} text-xs transition-colors`}>
                                            Senhas coincidem
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Button type="submit" disabled={isLoading}>
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Atualizar Senha
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            {/* Seção 2: Integrações */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Plug className="h-5 w-5" />
                        Integrações
                    </CardTitle>
                    <CardDescription>
                        Conecte serviços externos para ampliar as funcionalidades da plataforma.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                                <Calendar className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="font-medium">Google Calendar</p>
                                <p className="text-sm text-muted-foreground">
                                    Sincronize seus eventos com o Google Calendar
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-muted-foreground/30 bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                                Desconectado
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    toast({
                                        title: "Em breve!",
                                        description: "Integração com Google Calendar disponível em breve.",
                                    })
                                }
                            >
                                Conectar
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Seção 3: Termos de Uso */}
            <Card>
                <CardHeader>
                    <CardTitle>Termos e Privacidade</CardTitle>
                    <CardDescription>
                        Informações legais sobre o uso da plataforma.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Ao utilizar o Arch Smart, você concorda com nossos{" "}
                        <a href="/termos" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Termos de Uso</a>
                        {" "}e{" "}
                        <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Política de Privacidade</a>.
                    </p>
                </CardContent>
            </Card>

            {/* Seção 3: Zona de Perigo */}
            <Card className="border-destructive/20 bg-destructive/5">
                <CardHeader>
                    <div className="flex items-center gap-2 text-destructive">
                        <ShieldAlert className="h-5 w-5" />
                        <CardTitle className="text-destructive">Zona de Perigo</CardTitle>
                    </div>
                    <CardDescription>
                        Ações irreversíveis que afetam sua conta.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h4 className="font-medium text-destructive">Excluir Conta</h4>
                            <p className="text-sm text-muted-foreground">
                                Sua conta será desativada e você perderá acesso imediatamente.
                            </p>
                        </div>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir Conta
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Essa ação não pode ser desfeita imediatamente. Sua conta será marcada como inativa e você perderá acesso a todos os seus projetos e dados.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={onDeleteAccount}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                        {isDeleting ? "Excluindo..." : "Sim, excluir minha conta"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
