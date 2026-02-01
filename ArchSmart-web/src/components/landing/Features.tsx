'use client';

import { Layout, Pointer, Zap } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TabContent {
  badge: string;
  title: string;
  description: string;
  buttonText: string;
  imageSrc: string;
  imageAlt: string;
}

interface Tab {
  value: string;
  icon: React.ReactNode;
  label: string;
  content: TabContent;
}

interface Feature108Props {
  badge?: string;
  heading?: string;
  description?: string;
  tabs?: Tab[];
}

const Feature108 = ({
  badge = "Funcionalidades",
  heading = "A Nova Geração da Arquitetura",
  description = "Uma suíte completa de ferramentas para gerenciar seus projetos, orçamentos e clientes.",
  tabs = [
    {
      value: "tab-1",
      icon: <Zap className="h-auto w-4 shrink-0" />,
      label: "Orçamentos",
      content: {
        badge: "Controle Financeiro",
        title: "Rastreamento Automático",
        description:
          "Monitore cada centavo com nossas ferramentas de orçamento automatizadas. Crie relatórios financeiros detalhados e previsões precisas.",
        buttonText: "Ver Detalhes",
        imageSrc: "https://shadcnblocks.com/images/block/placeholder-dark-1.svg", // Placeholder, replace later
        imageAlt: "Interface de Orçamento",
      },
    },
    {
      value: "tab-2",
      icon: <Pointer className="h-auto w-4 shrink-0" />,
      label: "Portal do Cliente",
      content: {
        badge: "Engajamento",
        title: "Interação Perfeita",
        description:
          "Ofereça aos seus clientes um portal exclusivo para visualizar o progresso, aprovar designs e comunicar-se diretamente com você.",
        buttonText: "Acessar Portal",
        imageSrc: "https://shadcnblocks.com/images/block/placeholder-dark-2.svg",
        imageAlt: "Portal do Cliente",
      },
    },
    {
      value: "tab-3",
      icon: <Layout className="h-auto w-4 shrink-0" />,
      label: "Gestão",
      content: {
        badge: "Organização",
        title: "Gerencie Projetos com Eficiência",
        description:
          "Gerencie cronogramas, tarefas e recursos em um só lugar. Garanta que seus projetos sejam entregues no prazo e dentro do escopo.",
        buttonText: "Explorar Ferramentas",
        imageSrc: "https://shadcnblocks.com/images/block/placeholder-dark-3.svg",
        imageAlt: "Gestão de Projetos",
      },
    },
  ],
}: Feature108Props) => {
  return (
    <section className="py-24 md:py-32">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <Badge variant="outline" className="bg-background">{badge}</Badge>
          <h2 className="max-w-2xl text-3xl font-bold md:text-4xl tracking-tight">
            {heading}
          </h2>
          <p className="max-w-xl text-muted-foreground text-lg">{description}</p>
        </div>
        <Tabs defaultValue={tabs[0].value} className="mt-12">
          <TabsList className="flex flex-col items-center justify-center gap-4 sm:flex-row md:gap-8 bg-transparent h-auto p-0">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border border-transparent data-[state=active]:border-border transition-all shadow-sm"
              >
                {tab.icon} {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="mx-auto mt-12 max-w-5xl rounded-3xl bg-muted/30 border border-border p-6 lg:p-12">
            {tabs.map((tab) => (
              <TabsContent
                key={tab.value}
                value={tab.value}
                className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16"
              >
                <div className="flex flex-col gap-6 text-left">
                  <Badge variant="secondary" className="w-fit">
                    {tab.content.badge}
                  </Badge>
                  <h3 className="text-2xl font-bold lg:text-4xl tracking-tight">
                    {tab.content.title}
                  </h3>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    {tab.content.description}
                  </p>
                  <Button className="mt-4 w-fit" size="lg">
                    {tab.content.buttonText}
                  </Button>
                </div>
                <div className="relative aspect-video w-full overflow-hidden rounded-2xl border bg-background shadow-lg">
                  <Image
                    src={tab.content.imageSrc}
                    alt={tab.content.imageAlt}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </div>
    </section>
  );
};

export { Feature108 as Features };
