"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // Keeping it just in case, but unused for lead capture
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api-url";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface LeadCaptureProps {
  title?: string;
  description?: string;
  sourcePage?: string; // To track where it was used if we expand origin logic later in frontend
}

const LeadCapture = ({
  title = "Entre na Lista de Espera",
  description = "Receba novidades exclusivas e solicite acesso antecipado ao Arch Smart.",
  sourcePage = "SITE"
}: LeadCaptureProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: ""
    }
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(apiUrl("/api/leads"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone || undefined,
          origin: "SITE" // Hardcoded for now as per requirements, could use sourcePage prop
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Erro ao enviar cadastro.");
      }

      toast({
        title: "Cadastro realizado! 🚀",
        description: "Agradecemos o interesse. Em breve entraremos em contato.",
        variant: "default",
        className: "bg-primary text-primary-foreground border-none",
      });

      reset();
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

  return (
    <section className="py-24 bg-muted/30">
      <div className="container px-4 md:px-6">
        <div className="mx-auto flex max-w-5xl flex-col lg:flex-row items-center justify-between gap-12">
          {/* Text Content */}
          <div className="lg:w-1/2 space-y-6 text-center lg:text-left">
            <h2 className="text-3xl font-bold tracking-tight lg:text-5xl">
              {title}
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {description}
            </p>
            <div className="hidden lg:block">
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Acesso prioritário a novas features
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Newsletter com dicas de gestão
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Convite para eventos exclusivos
                </li>
              </ul>
            </div>
          </div>

          {/* Form */}
          <div className="w-full lg:w-[450px] bg-background rounded-2xl border shadow-lg p-6 md:p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  placeholder="Seu nome"
                  {...register("name")}
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && <span className="text-xs text-destructive">{errors.name.message}</span>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail Profissional <span className="text-destructive">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@escritorio.com"
                  {...register("email")}
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && <span className="text-xs text-destructive">{errors.email.message}</span>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone / WhatsApp</Label>
                <Input
                  id="phone"
                  placeholder="(11) 99999-9999"
                  {...register("phone")}
                />
              </div>

              <Button type="submit" className="w-full h-12 text-base font-semibold mt-2" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Solicitar Acesso"
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground pt-2">
                Seus dados estão seguros conosco.
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export { LeadCapture };
