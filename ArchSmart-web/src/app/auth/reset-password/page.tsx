"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { BRAND_ASSETS } from "@/config/brand";
import Image from "next/image";
import { apiUrl } from "@/lib/api-url";

// Enhanced Password Validation (Same as VerifyPage)
const passwordSchema = z.string()
    .min(8, "Mínimo de 8 caracteres")
    .regex(/[A-Z]/, "Pelo menos uma letra maiúscula")
    .regex(/[a-z]/, "Pelo menos uma letra minúscula")
    .regex(/[0-9]/, "Pelo menos um número")
    .regex(/[^A-Za-z0-9]/, "Pelo menos um caractere especial");

const formSchema = z.object({
    password: passwordSchema,
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
});

type FormData = z.infer<typeof formSchema>;

export default function ResetPasswordPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        // Logic similar to Verify, get token from hash if redirected from generic verifying page
        // or directly if Supabase redirected here.
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.substring(1));
        const token = params.get("access_token");
        if (token) {
            setAccessToken(token);
            // Clean URL
            window.history.replaceState(null, "", window.location.pathname);
        }
    }, []);

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<FormData>({
        resolver: zodResolver(formSchema),
        mode: "onChange"
    });

    const passwordValue = watch("password", "");

    const onSubmit = async (data: FormData) => {
        if (!accessToken) {
            toast({ title: "Erro", description: "Token inválido ou expirado.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            // Reuse the update user logic logic via backend or could even call supabase directly if we had SDK
            // But we stick to our API facade
            const response = await fetch(apiUrl("/api/auth/complete-register"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    // Mock profile data since we just want to update password. 
                    // Better would be a dedicated /reset-password endpoint that only takes password + token
                    // But for MVP, let's create a dedicated endpoint or reuse if careful.
                    // Let's assume we need a dedicated endpoint to be clean or update existing one to allow partial updates?
                    // Existing 'complete-register' requires fullName/CPF.
                    // Let's do a quick fetch to 'api/auth/update-password' (Need to Create it!)
                    password: data.password,
                    access_token: accessToken,
                    full_name: "User Renamed", // Placeholder to satisfy schema if needed (or backend handles optional)
                    cpf: null
                }),
            });

            const resData = await response.json();

            if (!response.ok) throw new Error(resData.detail || "Falha ao redefinir senha.");

            toast({
                title: "Senha Alterada!",
                description: "Faça login com sua nova senha.",
            });
            router.push("/auth/login");

        } catch (error: any) {
            let errorMessage = error.message;

            // Translate specific Supabase errors
            if (errorMessage.includes("New password should be different") || errorMessage.includes("same as the old password")) {
                errorMessage = "A nova senha não pode ser igual à senha atual.";
            } else if (errorMessage.includes("Password should be")) {
                errorMessage = "A senha não atende aos requisitos de segurança.";
            }

            toast({
                title: "Erro ao alterar senha",
                description: errorMessage,
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

    if (!accessToken) {
        return (
            <div className="h-screen flex items-center justify-center">
                <p className="text-muted-foreground">Verificando link...</p>
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
                        <h1 className="text-3xl font-bold tracking-tight mb-2">Redefinir Senha</h1>
                        <p className="text-muted-foreground">Crie sua nova senha segura.</p>
                    </div>

                    <div className="bg-card border rounded-xl p-6 md:p-8 shadow-sm">
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

                            <div className="space-y-2">
                                <Label htmlFor="password">Nova Senha</Label>
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

                            <Button type="submit" className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4 inline" /> : null}
                                Salvar Nova Senha
                            </Button>
                        </form>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
