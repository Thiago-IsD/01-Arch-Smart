"use client";

import React, { useState } from "react";
import { MessageCircle, X, SendHorizontal, Bot, User as UserIcon } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Message {
    id: number;
    sender: "bot" | "user";
    text: string;
    timestamp: string;
}

// Mock messages for layout validation
const MOCK_MESSAGES: Message[] = [
    {
        id: 1,
        sender: "bot",
        text: "Olá! Sou o Assistente Ecowe. Como posso ajudar você hoje?",
        timestamp: "10:30",
    },
    {
        id: 2,
        sender: "user",
        text: "Preciso de ajuda com meu projeto",
        timestamp: "10:31",
    },
];

export function GlobalChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages] = useState<Message[]>(MOCK_MESSAGES);
    const [inputValue, setInputValue] = useState("");

    const handleSend = () => {
        if (inputValue.trim()) {
            // TODO: Implement send logic
            console.log("Sending message:", inputValue);
            setInputValue("");
        }
    };

    return (
        <>
            {/* Chat Window */}
            <Card
                className={`fixed z-50 shadow-2xl border-border flex flex-col transition-all duration-300 ease-in-out
                    ${isOpen
                        ? "opacity-100 translate-y-0 pointer-events-auto"
                        : "opacity-0 translate-y-4 pointer-events-none"
                    }
                    inset-4 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-96 sm:h-[500px]
                `}
            >
                {/* Header */}
                <CardHeader className="flex flex-row items-center justify-between border-b border-border p-4 bg-primary/5">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 bg-primary">
                            <AvatarFallback className="bg-primary text-primary-foreground">
                                <Bot className="h-4 w-4" />
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <h3 className="font-semibold text-sm text-foreground">
                                Assistente Ecowe
                            </h3>
                            <p className="text-xs text-muted-foreground">Online</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsOpen(false)}
                        className="h-8 w-8 rounded-full hover:bg-accent"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </CardHeader>

                {/* Messages Area */}
                <CardContent className="flex-1 p-4 overflow-hidden">
                    <ScrollArea className="h-full pr-4">
                        <div className="space-y-4">
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex gap-3 ${message.sender === "user" ? "flex-row-reverse" : ""
                                        }`}
                                >
                                    {/* Avatar */}
                                    <Avatar
                                        className={`h-8 w-8 shrink-0 ${message.sender === "bot"
                                            ? "bg-primary"
                                            : "bg-secondary"
                                            }`}
                                    >
                                        <AvatarFallback
                                            className={
                                                message.sender === "bot"
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-secondary text-secondary-foreground"
                                            }
                                        >
                                            {message.sender === "bot" ? (
                                                <Bot className="h-4 w-4" />
                                            ) : (
                                                <UserIcon className="h-4 w-4" />
                                            )}
                                        </AvatarFallback>
                                    </Avatar>

                                    {/* Message Bubble */}
                                    <div
                                        className={`flex flex-col gap-1 max-w-[75%] ${message.sender === "user" ? "items-end" : ""
                                            }`}
                                    >
                                        <div
                                            className={`rounded-2xl px-4 py-2 ${message.sender === "bot"
                                                ? "bg-accent text-foreground"
                                                : "bg-primary text-primary-foreground"
                                                }`}
                                        >
                                            <p className="text-sm">{message.text}</p>
                                        </div>
                                        <span className="text-xs text-muted-foreground px-2">
                                            {message.timestamp}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>

                {/* Input Area */}
                <CardFooter className="border-t border-border p-4">
                    <div className="flex gap-2 w-full">
                        <Input
                            placeholder="Digite sua mensagem..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            className="flex-1"
                        />
                        <Button
                            size="icon"
                            onClick={handleSend}
                            disabled={!inputValue.trim()}
                            className="shrink-0"
                        >
                            <SendHorizontal className="h-4 w-4" />
                        </Button>
                    </div>
                </CardFooter>
            </Card>

            {/* Floating Button */}
            <Button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 ${isOpen ? "scale-0 opacity-0" : "scale-100 opacity-100"
                    }`}
                size="icon"
            >
                <MessageCircle className="h-6 w-6" />
            </Button>
        </>
    );
}
