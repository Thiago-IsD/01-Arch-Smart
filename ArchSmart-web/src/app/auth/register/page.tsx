"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { BRAND_ASSETS } from "@/config/brand";
import Image from "next/image";

// Schema for Email Only
const formSchema = z.object({
    email: z.string().email("E-mail inválido"),
});

type FormData = z.infer<typeof formSchema>;

export default function RegisterRequestPage() {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSent, setIsSent] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<FormData>({
        resolver: zodResolver(formSchema),
    });

    const onSubmit = async (data: FormData) => {
        setIsSubmitting(true);
        try {
            const response = await fetch("http://localhost:8000/api/auth/register-request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: data.email,
                    // Redirect to callback page which will forward to verify with the token
                    redirect_url: `${window.location.origin}/auth/callback`
                }),
            });

            const resData = await response.json();

            if (!response.ok) {
                throw new Error(resData.detail || "Erro ao solicitar cadastro.");
            }

            setIsSent(true);
            toast({
                title: "Verifique seu e-mail! 📧",
                description: "Enviamos um link mágico de acesso para você.",
            });

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

    if (isSent) {
        return (
            <div className="flex min-h-screen flex-col bg-background">
                <Navbar />
                <main className="flex-1 flex flex-col items-center justify-center p-4">
                    <div className="max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in duration-500">
                        <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Mail size={40} />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">E-mail Enviado!</h1>
                        <p className="text-muted-foreground text-lg">
                            Clique no link que enviamos para seu e-mail para continuar o cadastro.
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Não recebeu? Verifique a caixa de spam ou tente novamente.
                        </p>
                        <Button variant="outline" onClick={() => setIsSent(false)}>
                            Tentar outro e-mail
                        </Button>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

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
                        <h1 className="text-3xl font-bold tracking-tight mb-2">Cadastre-se</h1>
                        <p className="text-muted-foreground">
                            Comece digitando seu e-mail profissional.
                        </p>
                    </div>

                    <div className="bg-card border rounded-xl p-6 md:p-8 shadow-sm">
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                            <div className="space-y-2">
                                <Label htmlFor="email">E-mail Profissional</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="seu@email.com"
                                    {...register("email")}
                                    className={errors.email ? "border-red-500" : ""}
                                />
                                {errors.email && <span className="text-xs text-red-500">{errors.email.message}</span>}
                            </div>

                            <Button type="submit" className="w-full h-12 text-base font-bold bg-[#008080] hover:bg-[#008080]/90 text-white" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    "Criar Conta"
                                )}
                            </Button>
                        </form>
                        <div className="mt-6 text-center text-sm">
                            Já tem conta?{" "}
                            <Link href="/auth/login" className="font-semibold text-[#008080] hover:underline">
                                Fazer login
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
