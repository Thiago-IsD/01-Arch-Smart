"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface BreadcrumbContextType {
    customLabels: Record<string, string>;
    setCustomLabel: (segment: string, label: string) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextType>({
    customLabels: {},
    setCustomLabel: () => { },
});

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
    const [customLabels, setCustomLabels] = useState<Record<string, string>>({});

    const setCustomLabel = (segment: string, label: string) => {
        setCustomLabels((prev) => {
            if (prev[segment] === label) return prev;
            return { ...prev, [segment]: label };
        });
    };

    return (
        <BreadcrumbContext.Provider value={{ customLabels, setCustomLabel }}>
            {children}
        </BreadcrumbContext.Provider>
    );
}

export const useBreadcrumb = () => useContext(BreadcrumbContext);

export function DynamicBreadcrumb({ segment, label }: { segment: string; label: string }) {
    const { setCustomLabel } = useBreadcrumb();

    useEffect(() => {
        if (segment && label) {
            setCustomLabel(segment, label);
        }
    }, [segment, label, setCustomLabel]);

    return null;
}
