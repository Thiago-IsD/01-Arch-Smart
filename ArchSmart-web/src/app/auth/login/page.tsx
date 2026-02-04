"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { BRAND_ASSETS } from "@/config/brand";
import Image from "next/image";

const formSchema = z.object({
    email: z.string().email("E-mail inválido"),
    password: z.string().min(1, "Digite sua senha"),
});

type FormData = z.infer<typeof formSchema>;

export default function LoginPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
    } = useForm<FormData>({
        resolver: zodResolver(formSchema),
    });

    // Load saved email on mount
    useEffect(() => {
        const savedEmail = localStorage.getItem("rememberedEmail");
        if (savedEmail) {
            setValue("email", savedEmail);
            setRememberMe(true);
        }
    }, [setValue]);

    const onSubmit = async (data: FormData) => {
        setIsSubmitting(true);
        try {
            const response = await fetch("http://localhost:8000/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            const resData = await response.json();

            if (!response.ok) {
                throw new Error(resData.detail || "Falha no login.");
            }

            // Check for Supabase Access Token
            if (resData.access_token) {
                // Handle remember me
                if (rememberMe) {
                    localStorage.setItem("rememberedEmail", data.email);
                } else {
                    localStorage.removeItem("rememberedEmail");
                }

                // Create Supabase session
                const { createClient } = await import("@/utils/supabase/client");
                const supabase = createClient();

                const { error: sessionError } = await supabase.auth.setSession({
                    access_token: resData.access_token,
                    refresh_token: resData.refresh_token,
                });

                if (sessionError) {
                    console.error("Session creation error:", sessionError);
                    throw new Error("Erro ao criar sessão");
                }

                toast({
                    title: "Bem-vindo de volta! 👋",
                    description: "Login realizado com sucesso.",
                });

                // Small delay to ensure session is set
                await new Promise(resolve => setTimeout(resolve, 500));
                router.push("/dashboard");
            } else {
                throw new Error("Resposta inválida do servidor.");
            }

        } catch (error: any) {
            toast({
                title: "Erro de acesso",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="flex-1 py-12 lg:py-24 flex items-center justify-center">
                <div className="container px-4 md:px-6 max-w-md mx-auto">
                    {/* Logo */}
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
                        <h1 className="text-3xl font-bold tracking-tight mb-2">Login</h1>
                        <p className="text-muted-foreground">
                            Acesse sua conta Arch Smart.
                        </p>
                    </div>

                    <div className="bg-card border rounded-xl p-6 md:p-8 shadow-sm">
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                            <div className="space-y-2">
                                <Label htmlFor="email">E-mail</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="seu@email.com"
                                    {...register("email")}
                                    className={errors.email ? "border-red-500" : ""}
                                />
                                {errors.email && <span className="text-xs text-red-500">{errors.email.message}</span>}
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Senha</Label>
                                    <Link href="/auth/recover" className="text-xs text-muted-foreground hover:underline">
                                        Esqueceu a senha?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="******"
                                        {...register("password")}
                                        className={`pr-10 ${errors.password ? "border-red-500" : ""}`}
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

                            {/* Remember Me Checkbox */}
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="remember"
                                    checked={rememberMe}
                                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                                />
                                <label
                                    htmlFor="remember"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                    Lembrar-me
                                </label>
                            </div>

                            <Button type="submit" className="w-full h-12 text-base font-bold bg-[#008080] hover:bg-[#008080]/90 text-white" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Entrando...
                                    </>
                                ) : (
                                    "Entrar"
                                )}
                            </Button>
                        </form>
                        <div className="mt-6 text-center text-sm">
                            Não tem conta?{" "}
                            <Link href="/auth/register" className="font-semibold text-[#008080] hover:underline">
                                Criar conta
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
