"use client"

import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api/client"

import { queryDoDashboard } from "./queries"

export function useDashboard() {
    return useQuery(queryDoDashboard(api))
}
