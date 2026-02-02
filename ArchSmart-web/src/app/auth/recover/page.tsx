"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { BRAND_ASSETS } from "@/config/brand";
import Image from "next/image";

const formSchema = z.object({
    email: z.string().email("E-mail inválido"),
});

type FormData = z.infer<typeof formSchema>;

export default function RecoverPage() {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

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
            const response = await fetch("http://localhost:8000/api/auth/recover-request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            // We don't verify success/fail to avoid user enumeration, but usually API gives 200
            toast({
                title: "Solicitação Enviada",
                description: "Se o e-mail existir, você receberá um link de recuperação.",
            });

        } catch (error: any) {
            toast({
                title: "Erro",
                description: "Falha ao enviar solicitação.",
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
                        <h1 className="text-3xl font-bold tracking-tight mb-2">Recuperar Senha</h1>
                        <p className="text-muted-foreground">
                            Informe seu e-mail para receber o link de redefinição.
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

                            <Button type="submit" className="w-full h-12 text-base font-bold bg-[#008080] hover:bg-[#008080]/90 text-white" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    "Enviar Link"
                                )}
                            </Button>
                        </form>
                        <div className="mt-6 text-center text-sm">
                            Lembrou a senha?{" "}
                            <Link href="/auth/login" className="font-semibold text-[#008080] hover:underline">
                                Voltar para Login
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
