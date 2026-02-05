"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, Check, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { BRAND_ASSETS } from "@/config/brand";
import Image from "next/image";
import { apiUrl } from "@/lib/api-url";
import { createClient } from "@/utils/supabase/client";

// Enhanced Password Validation
const passwordSchema = z.string()
    .min(8, "Mínimo de 8 caracteres")
    .regex(/[A-Z]/, "Pelo menos uma letra maiúscula")
    .regex(/[a-z]/, "Pelo menos uma letra minúscula")
    .regex(/[0-9]/, "Pelo menos um número")
    .regex(/[^A-Za-z0-9]/, "Pelo menos um caractere especial");

const formSchema = z.object({
    full_name: z.string().min(3, "Nome completo inválido"),
    password: passwordSchema,
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
});

type FormData = z.infer<typeof formSchema>;

export default function VerifyPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<"LOADING" | "VALID" | "INVALID">("LOADING");
    const [showPassword, setShowPassword] = useState(false);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<FormData>({
        resolver: zodResolver(formSchema),
        mode: "onChange"
    });

    const passwordValue = watch("password", "");

    useEffect(() => {
        // For Email Confirmation flow, token comes as query parameter
        const searchParams = new URLSearchParams(window.location.search);
        const tokenFromQuery = searchParams.get("token");
        const typeFromQuery = searchParams.get("type");

        // Also check hash fragment for backward compatibility with magic link
        const hash = window.location.hash;
        const hashParams = new URLSearchParams(hash.substring(1));
        const tokenFromHash = hashParams.get("access_token");
        const typeFromHash = hashParams.get("type");

        const token = tokenFromQuery || tokenFromHash;
        const type = typeFromQuery || typeFromHash;

        if (token) {
            setAccessToken(token);

            // Clean URL without reloading
            window.history.replaceState(null, "", window.location.pathname);

            if (type === "recovery") {
                // Keep status as LOADING to avoid flashing the form
                router.push(`/auth/reset-password#access_token=${token}`);
                return;
            }

            setStatus("VALID");
        } else {
            setStatus("INVALID");
        }
    }, [router]);

    const onSubmit = async (data: FormData) => {
        if (!accessToken) return;

        setIsSubmitting(true);
        try {
            const response = await fetch(apiUrl("/api/auth/complete-register"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    full_name: data.full_name,
                    password: data.password,
                    access_token: accessToken,
                    cpf: null // Explicitly null as requested
                }),
            });

            const resData = await response.json();

            if (!response.ok) {
                throw new Error(resData.detail || "Erro ao finalizar cadastro.");
            }

            toast({
                title: "Sucesso!",
                description: "Cadastro concluído! Fazendo login...",
            });

            // Auto-login after registration
            try {
                const loginResponse = await fetch(apiUrl("/api/auth/login"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: resData.email,
                        password: data.password,
                    }),
                });

                if (loginResponse.ok) {
                    const loginData = await loginResponse.json();

                    // Create Supabase session
                    const supabase = createClient();
                    const { error: sessionError } = await supabase.auth.setSession({
                        access_token: loginData.access_token,
                        refresh_token: loginData.refresh_token,
                    });

                    if (sessionError) {
                        console.error("Session creation error:", sessionError);
                        throw new Error("Erro ao criar sessão");
                    }

                    // Small delay to ensure session is set
                    await new Promise(resolve => setTimeout(resolve, 500));
                    router.push("/dashboard");
                } else {
                    throw new Error("Falha no login automático");
                }
            } catch (loginError: any) {
                console.error("Auto-login failed:", loginError);
                // Fallback: redirect to login page
                toast({
                    title: "Cadastro concluído!",
                    description: "Faça login para acessar.",
                });
                await new Promise(resolve => setTimeout(resolve, 1500));
                router.push("/auth/login");
            }

        } catch (error: any) {
            toast({
                title: "Erro",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Password Visual Feedback
    const requirements = [
        { label: "Mínimo 8 caracteres", test: (p: string) => p.length >= 8 },
        { label: "Letra Maiúscula", test: (p: string) => /[A-Z]/.test(p) },
        { label: "Letra Minúscula", test: (p: string) => /[a-z]/.test(p) },
        { label: "Número", test: (p: string) => /[0-9]/.test(p) },
        { label: "Caractere Especial", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
    ];

    if (status === "LOADING") {
        return (
            <div className="h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (status === "INVALID") {
        return (
            <div className="h-screen flex flex-col items-center justify-center space-y-4">
                <h1 className="text-2xl font-bold text-red-600">Link Inválido ou Expirado</h1>
                <Button onClick={() => router.push("/auth/register")}>Voltar para Cadastro</Button>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="flex-1 py-12 lg:py-24 flex items-center justify-center">
                <div className="container px-4 md:px-6 max-w-md mx-auto">

                    {/* Branding */}
                    <div className="flex justify-center mb-8">
                        <div className="relative w-32 h-32">
                            <Image
                                src={BRAND_ASSETS.vertical}
                                alt="Arch Smart Logo"
                                fill
                                className="object-contain"
                                priority
                            />
                        </div>
                    </div>

                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold tracking-tight mb-2">Finalizar Cadastro</h1>
                        <p className="text-muted-foreground">
                            Crie sua senha segura para acessar a plataforma.
                        </p>
                    </div>

                    <div className="bg-card border rounded-xl p-6 md:p-8 shadow-sm">
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

                            <div className="space-y-2">
                                <Label htmlFor="full_name">Nome Completo</Label>
                                <Input id="full_name" placeholder="Seu Nome" {...register("full_name")} />
                                {errors.full_name && <span className="text-xs text-red-500">{errors.full_name.message}</span>}
                            </div>

                            {/* Password input with toggle */}
                            <div className="space-y-2">
                                <Label htmlFor="password">Crie uma Senha</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="******"
                                        {...register("password")}
                                        className="pr-10" // Add padding for icon
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {errors.password && <span className="text-xs text-red-500">{errors.password.message}</span>}
                            </div>

                            {/* Password Requirements Checklist - Reference Style */}
                            <div className="rounded-lg border bg-card p-4 text-sm shadow-sm space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {requirements.map((req, idx) => {
                                        const isValid = req.test(passwordValue);
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
                                    {/* Match Confirm Password logic visually */}
                                    <div className="flex items-center gap-2">
                                        {watch("confirmPassword") && watch("password") === watch("confirmPassword") ? (
                                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                                        ) : (
                                            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 shrink-0 ml-1.5 mr-1" />
                                        )}
                                        <span className={`${watch("confirmPassword") && watch("password") === watch("confirmPassword") ? "text-foreground" : "text-muted-foreground"} text-xs transition-colors`}>
                                            Senhas coincidem
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirme a Senha</Label>
                                <Input id="confirmPassword" type="password" placeholder="******" {...register("confirmPassword")} />
                                {errors.confirmPassword && <span className="text-xs text-red-500">{errors.confirmPassword.message}</span>}
                            </div>

                            {/* Implicit Consent Text */}
                            <p className="text-xs text-muted-foreground text-center px-4">
                                Ao cadastrar, você concorda com nossos{" "}
                                <Link href="/termos" className="underline hover:text-foreground">
                                    Termos de Uso
                                </Link>{" "}
                                e{" "}
                                <Link href="/privacidade" className="underline hover:text-foreground">
                                    Política de Privacidade
                                </Link>
                                .
                            </p>

                            <Button type="submit" className="w-full h-12 text-base font-bold bg-[#008080] hover:bg-[#008080]/90 text-white" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Criando conta...
                                    </>
                                ) : (
                                    "Concluir & Acessar"
                                )}
                            </Button>
                        </form>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
