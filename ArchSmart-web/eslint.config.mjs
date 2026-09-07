import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const PROIBICOES = [
  {
    selector: "CallExpression[callee.name='fetch']",
    message: "Chame a API por `api()` de @/lib/api/client — ele resolve sessao, monta header, propaga AbortSignal e traduz erro. Ver Secao 5.",
  },
  {
    selector: "CallExpression[callee.name='createBrowserClient'], CallExpression[callee.name='createServerClient']",
    message: "So @/lib/api/auth.ts e @/lib/api/auth.server.ts falam com o Supabase — sao o ponto de troca por Cognito.",
  },
  {
    selector: "CallExpression[callee.name='useEffect'] CallExpression[callee.name='fetch']",
    message: "Busca de dado em useEffect nao tem cache, nem cancelamento, nem estado de erro. Use um hook de @/features/<dominio>/hooks.ts.",
  },
  {
    selector: "CallExpression[callee.name='useEffect'] CallExpression[callee.name='api']",
    message: "Busca de dado em useEffect nao tem cache, nem cancelamento, nem estado de erro. Use um hook de @/features/<dominio>/hooks.ts.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  { files: ["src/**/*.{ts,tsx}"], rules: { "no-restricted-syntax": ["warn", ...PROIBICOES] } },
  // Territorio que a Secao 5 ja migrou: aqui o lint bloqueia de verdade, em
  // vez de so avisar. O resto do app (~30 telas) fica em "warn" ate a Secao 8
  // migrar cada uma; subir o numero delas de uma vez so faria o PR nascer
  // vermelho e o portao ser desligado na primeira semana (ADR 0006).
  {
    files: [
      "src/features/**/*.{ts,tsx}",
      "src/lib/**/*.{ts,tsx}",
      "src/app/(dashboard)/library/**/*.{ts,tsx}",
    ],
    rules: { "no-restricted-syntax": ["error", ...PROIBICOES] },
  },
  // lib/api/ e o territorio isento: e onde `fetch` e o Supabase devem morar.
  // Tem que vir por ultimo — casa "src/lib/**" tambem, e em flat config o
  // ultimo bloco que casa um arquivo vence; se viesse antes do bloco de erro
  // acima, o bloco de erro apagaria esta isencao para tudo em src/lib/api/.
  { files: ["src/lib/api/**/*.ts", "src/proxy.ts"], rules: { "no-restricted-syntax": "off" } },
]);

export default eslintConfig;
