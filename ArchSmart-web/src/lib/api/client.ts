"use client"

import { criarCliente, type ClienteApi } from "@/lib/api/core"
import { getAccessToken } from "@/lib/api/auth"

/** Cliente do browser. Toda tela usa este. */
export const api: ClienteApi = criarCliente({ resolverToken: getAccessToken })
