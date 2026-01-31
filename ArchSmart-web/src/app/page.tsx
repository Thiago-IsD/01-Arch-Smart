'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/smart-core/header';

export default function Home() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        if (!apiUrl) {
          console.error("NEXT_PUBLIC_API_URL not set");
          setStatus('error');
          return;
        }

        const res = await fetch(`${apiUrl}/health`);
        if (res.ok) {
          setStatus('ok');
        } else {
          setStatus('error');
        }
      } catch (error) {
        console.error("Health check failed", error);
        setStatus('error');
      }
    };

    checkHealth();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center p-24">
        <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
          <h1 className="text-4xl font-bold mb-8">Arch Smart</h1>
          <div className="fixed bottom-0 left-0 flex h-48 w-full items-end justify-center bg-gradient-to-t from-white via-white dark:from-black dark:via-black lg:static lg:h-auto lg:w-auto lg:bg-none">
            {status === 'loading' && (
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground">
                Conectando...
              </span>
            )}
            {status === 'ok' && (
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-green-500 text-white border-transparent shadow hover:bg-green-500/80">
                Ambiente DEV Conectado
              </span>
            )}
            {status === 'error' && (
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-red-500 text-white border-transparent shadow hover:bg-red-500/80">
                Falha na API
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
