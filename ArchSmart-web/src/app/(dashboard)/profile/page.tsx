"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building2, User, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/client";

interface ProfileFormData {
    full_name: string;
}

interface BrandingFormData {
    company_name: string;
}

export default function ProfilePage() {
    const { toast } = useToast();
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [isLoadingBranding, setIsLoadingBranding] = useState(false);
    const [userEmail, setUserEmail] = useState<string>("");

    // Profile form
    const {
        register: registerProfile,
        handleSubmit: handleSubmitProfile,
        setValue: setValueProfile,
        formState: { errors: errorsProfile },
    } = useForm<ProfileFormData>({
        defaultValues: {
            full_name: "",
        },
    });

    // Branding form
    const {
        register: registerBranding,
        handleSubmit: handleSubmitBranding,
        setValue: setValueBranding,
        formState: { errors: errorsBranding },
    } = useForm<BrandingFormData>({
        defaultValues: {
            company_name: "",
        },
    });

    // Load user data from backend
    useEffect(() => {
        const loadUserData = async () => {
            try {
                const supabase = createClient();
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    return;
                }

                // Load user email
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setUserEmail(user.email || "");
                }

                // Load profile data
                const apiUrlModule = await import("@/lib/api-url");
                const apiUrlFn = apiUrlModule.apiUrl;

                const profileResponse = await fetch(apiUrlFn("/api/users/me"), {
                    headers: {
                        "Authorization": `Bearer ${session.access_token}`,
                    },
                });

                if (!profileResponse.ok) {
                    const errorText = await profileResponse.text();
                    console.error("Profile fetch failed:", profileResponse.status, errorText);
                    return;
                }

                const profileData = await profileResponse.json();

                // Update profile form
                if (profileData.full_name) {
                    setValueProfile("full_name", profileData.full_name);
                }

                // Update branding form and logo preview
                if (profileData.account?.company_name) {
                    setValueBranding("company_name", profileData.account.company_name);
                }

                if (profileData.account?.logo_url) {
                    setLogoPreview(profileData.account.logo_url);
                }
            } catch (error) {
                console.error("Error loading user data:", error);
            }
        };

        loadUserData();
    }, [setValueProfile, setValueBranding]);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const onSubmitProfile = async (data: ProfileFormData) => {
        setIsLoadingProfile(true);
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                throw new Error("No active session");
            }

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/profile`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || "Failed to update profile");
            }

            toast({
                title: "Perfil atualizado",
                description: "Seus dados pessoais foram atualizados com sucesso.",
            });
        } catch (error) {
            console.error("Profile update error:", error);
            toast({
                title: "Erro",
                description: error instanceof Error ? error.message : "Falha ao atualizar perfil.",
                variant: "destructive",
            });
        } finally {
            setIsLoadingProfile(false);
        }
    };

    const onSubmitBranding = async (data: BrandingFormData) => {
        setIsLoadingBranding(true);
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                throw new Error("No active session");
            }

            const formData = new FormData();
            formData.append("company_name", data.company_name);
            if (logoFile) {
                formData.append("file", logoFile);
            }

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/account/branding`, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${session.access_token}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || "Failed to update branding");
            }

            const result = await response.json();

            // Update logo preview with the new URL
            if (result.logo_url) {
                setLogoPreview(result.logo_url);
            }

            toast({
                title: "Branding atualizado",
                description: "As informações do escritório foram atualizadas com sucesso.",
            });
        } catch (error) {
            console.error("Branding update error:", error);
            toast({
                title: "Erro",
                description: error instanceof Error ? error.message : "Falha ao atualizar branding.",
                variant: "destructive",
            });
        } finally {
            setIsLoadingBranding(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Configurações de Perfil</h1>
                <p className="text-muted-foreground mt-2">
                    Gerencie suas informações pessoais e branding do escritório
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Dados Pessoais */}
                <Card className="flex flex-col">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <User className="h-5 w-5 text-primary" />
                            <CardTitle>Dados Pessoais</CardTitle>
                        </div>
                        <CardDescription>
                            Atualize suas informações pessoais
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                        <form onSubmit={handleSubmitProfile(onSubmitProfile)} className="flex flex-col flex-1">
                            <div className="space-y-4 flex-1">
                                <div className="space-y-2">
                                    <Label htmlFor="full_name">Nome Completo</Label>
                                    <Input
                                        id="full_name"
                                        {...registerProfile("full_name", {
                                            required: "Nome é obrigatório",
                                        })}
                                        placeholder="Seu nome completo"
                                    />
                                    {errorsProfile.full_name && (
                                        <p className="text-sm text-destructive">
                                            {errorsProfile.full_name.message}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={userEmail}
                                        disabled
                                        className="bg-muted"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        O email não pode ser alterado
                                    </p>
                                </div>
                            </div>

                            <Button type="submit" disabled={isLoadingProfile} className="w-full mt-4">
                                {isLoadingProfile ? "Salvando..." : "Salvar Alterações"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Branding do Escritório */}
                <Card className="flex flex-col">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-primary" />
                            <CardTitle>Branding do Escritório</CardTitle>
                        </div>
                        <CardDescription>
                            Configure o nome e logo do seu escritório
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                        <form onSubmit={handleSubmitBranding(onSubmitBranding)} className="flex flex-col flex-1">
                            <div className="space-y-4 flex-1">
                                <div className="space-y-2">
                                    <Label htmlFor="company_name">Nome do Escritório / Marca</Label>
                                    <Input
                                        id="company_name"
                                        {...registerBranding("company_name")}
                                        placeholder="Nome do seu escritório"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Logo do Escritório</Label>
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-20 w-20">
                                            <AvatarImage src={logoPreview || undefined} />
                                            <AvatarFallback className="bg-primary/10">
                                                <Building2 className="h-8 w-8 text-primary" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                            <Input
                                                id="logo"
                                                type="file"
                                                accept="image/*"
                                                onChange={handleLogoChange}
                                                className="hidden"
                                            />
                                            <Label
                                                htmlFor="logo"
                                                className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                                            >
                                                <Upload className="h-4 w-4" />
                                                Escolher Imagem
                                            </Label>
                                            <p className="text-xs text-muted-foreground mt-2">
                                                PNG, JPG ou WEBP (max. 5MB)
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Button type="submit" disabled={isLoadingBranding} className="w-full mt-4">
                                {isLoadingBranding ? "Salvando..." : "Salvar Alterações"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
