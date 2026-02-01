"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, CircleCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface PricingFeature {
  text: string;
}
interface PricingPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: string;
  yearlyPrice: string;
  features: PricingFeature[];
  button: {
    text: string;
    url: string;
  };
}
interface PricingProps {
  heading?: string;
  description?: string;
  plans?: PricingPlan[];
}

const Pricing = ({
  heading = "Planos e Preços",
  description = "Escolha o plano que combina com seu fluxo de trabalho e cresça com facilidade.",
  plans = [
    {
      id: "starter",
      name: "Iniciante",
      description: "Para quem está começando a organizar",
      monthlyPrice: "R$ 49",
      yearlyPrice: "R$ 39",
      features: [
        { text: "1 projeto" },
        { text: "Analytics básico" },
        { text: "Suporte por email" },
        { text: "500MB de armazenamento" },
      ],
      button: {
        text: "Começar Agora",
        url: "/auth/register",
      },
    },
    {
      id: "growth",
      name: "Crescimento",
      description: "Para equipes em expansão",
      monthlyPrice: "R$ 149",
      yearlyPrice: "R$ 119",
      features: [
        { text: "Projetos ilimitados" },
        { text: "Ferramentas de colaboração" },
        { text: "Suporte prioritário via chat" },
        { text: "Analytics avançado" },
      ],
      button: {
        text: "Fazer Upgrade",
        url: "/auth/register",
      },
    },
    {
      id: "pro",
      name: "Profissional",
      description: "Para grandes demandas e agências",
      monthlyPrice: "R$ 399",
      yearlyPrice: "R$ 329",
      features: [
        { text: "Tudo ilimitado" },
        { text: "Gerente de conta dedicado" },
        { text: "Integrações customizadas" },
        { text: "SSO e Segurança Avançada" },
      ],
      button: {
        text: "Falar com Vendas",
        url: "/auth/register",
      },
    }
  ],
}: PricingProps) => {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section className="relative py-24 md:py-32 bg-background overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-background [background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#63e_100%)] opacity-0 dark:opacity-20" />
      <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="container px-4 md:px-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 text-center">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">{heading}</h2>
          <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">{description}</p>

          <div className="flex items-center gap-3 text-lg mt-4">
            <span className={cn("text-sm font-medium", !isYearly && "text-foreground", isYearly && "text-muted-foreground")}>Mensal</span>
            <Switch checked={isYearly} onCheckedChange={setIsYearly} />
            <span className={cn("text-sm font-medium", isYearly && "text-foreground", !isYearly && "text-muted-foreground")}>Anual</span>
          </div>

          <div className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan, i) => (
              <Card
                key={plan.id}
                className={cn(
                  "flex flex-col justify-between text-left relative overflow-hidden transition-all hover:shadow-lg",
                  plan.id === 'growth' && "border-primary shadow-md lg:scale-105 z-10"
                )}
              >
                {plan.id === 'growth' && (
                  <div className="absolute inset-x-0 top-0 bg-primary px-3 py-1.5 text-center text-xs font-semibold text-primary-foreground">
                    Mais Popular
                  </div>
                )}
                <CardHeader className={cn(plan.id === 'growth' && "pt-10")}>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <div className="my-4">
                    <span className="text-4xl font-bold">
                      {isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                    </span>
                    <span className="text-muted-foreground">
                      /mo
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Billed {isYearly ? 'anualmente' : 'mensalmente'}
                    </p>
                  </div>
                </CardHeader>

                <CardContent>
                  <Separator className="mb-6" />
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CircleCheck className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                        <span>{feature.text}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="mt-auto">
                  <Button asChild className="w-full" variant={plan.id === 'growth' ? 'default' : 'outline'}>
                    <Link href={plan.button.url}>
                      {plan.button.text}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export { Pricing };
