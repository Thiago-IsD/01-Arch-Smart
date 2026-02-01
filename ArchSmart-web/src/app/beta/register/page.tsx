"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const formSchema = z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    email: z.string().email("E-mail inválido"),
    phone: z.string().min(10, "Telefone inválido"),
    active_projects: z.string().min(1, "Selecione a quantidade de projetos"),
});

type FormData = z.infer<typeof formSchema>;

export default function BetaRegisterPage() {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<FormData>({
        resolver: zodResolver(formSchema),
    });

    const onSubmit = async (data: FormData) => {
        setIsSubmitting(true);
        try {
            const response = await fetch("http://localhost:8000/api/leads", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: data.name,
                    email: data.email,
                    phone: data.phone,
                    active_projects: parseInt(data.active_projects),
                    origin: "BETA_REGISTER"
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Erro ao enviar cadastro.");
            }

            setIsSuccess(true);
            window.scrollTo(0, 0);

        } catch (error: any) {
            toast({
                title: "Erro no cadastro",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="flex min-h-screen flex-col bg-background">
                <Navbar />
                <main className="flex-1 flex flex-col items-center justify-center p-4">
                    <div className="max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in duration-500">
                        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 size={40} />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">Cadastro Recebido!</h1>
                        <p className="text-muted-foreground text-lg">
                            Obrigado pelo interesse no Arch Smart. Nossa equipe entrará em contato em breve para liberar seu acesso.
                        </p>
                        <div className="pt-8">
                            <Button className="w-full h-12 text-base" asChild>
                                <Link href="/">
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Voltar para a Home
                                </Link>
                            </Button>
                        </div>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="flex-1 py-12 lg:py-24">
                <div className="container px-4 md:px-6 max-w-lg mx-auto">
                    <div className="mb-8 text-center">
                        <h1 className="text-3xl font-bold tracking-tight mb-2">Solicitar Acesso Beta</h1>
                        <p className="text-muted-foreground">
                            Preencha o formulário abaixo para entrar na fila de espera prioritária.
                        </p>
                    </div>

                    <div className="bg-card border rounded-xl p-6 md:p-8 shadow-sm">
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                            <div className="space-y-2">
                                <Label htmlFor="name">Nome Completo <span className="text-red-500">*</span></Label>
                                <Input
                                    id="name"
                                    placeholder="Seu nome"
                                    {...register("name")}
                                    className={errors.name ? "border-red-500" : ""}
                                />
                                {errors.name && <span className="text-xs text-red-500">{errors.name.message}</span>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">E-mail Profissional <span className="text-red-500">*</span></Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="seu@escritorio.com"
                                    {...register("email")}
                                    className={errors.email ? "border-red-500" : ""}
                                />
                                {errors.email && <span className="text-xs text-red-500">{errors.email.message}</span>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone">Telefone / WhatsApp <span className="text-red-500">*</span></Label>
                                <Input
                                    id="phone"
                                    placeholder="(11) 99999-9999"
                                    {...register("phone")}
                                    className={errors.phone ? "border-red-500" : ""}
                                />
                                {errors.phone && <span className="text-xs text-red-500">{errors.phone.message}</span>}
                            </div>

                            <div className="space-y-2">
                                <Label>Quantos projetos ativos você tem hoje? <span className="text-red-500">*</span></Label>
                                <Select onValueChange={(val) => setValue("active_projects", val)}>
                                    <SelectTrigger className={errors.active_projects ? "border-red-500" : ""}>
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">Apenas estudando/começando</SelectItem>
                                        <SelectItem value="1">1 a 3 projetos</SelectItem>
                                        <SelectItem value="5">4 a 10 projetos</SelectItem>
                                        <SelectItem value="10">Mais de 10 projetos</SelectItem>
                                    </SelectContent>
                                </Select>
                                {errors.active_projects && <span className="text-xs text-red-500">{errors.active_projects.message}</span>}
                            </div>

                            <Button type="submit" className="w-full h-12 text-base font-bold bg-[#F88379] hover:bg-[#F88379]/90 text-white" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    "Enviar Solicitação"
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
