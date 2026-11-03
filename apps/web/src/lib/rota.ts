'use client';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

/**
 * Seção ativa guardada no caminho da URL (`/base/secao`; a seção padrão fica em `/base`), sem recarregar a página.
 * Voltar/avançar do navegador e F5 mantêm a seção; links antigos com `#secao` são convertidos.
 */
export function useSecao<T extends string>(base: string, validas: readonly T[], padrao: T): [T, (s: T) => void] {
  const pathname = usePathname();
  const caminho = useCallback((s: T) => (s === padrao ? base : `${base}/${s}`), [base, padrao]);
  const doCaminho = useCallback((p: string): T => {
    const s = p.slice(base.length).split('/').filter(Boolean)[0] as T | undefined;
    return s && validas.includes(s) ? s : padrao;
  }, [base, validas, padrao]);
  const [secao, setSecao] = useState<T>(() => doCaminho(pathname));

  useEffect(() => {
    const s = doCaminho(pathname);
    setSecao(s);
    if (pathname !== caminho(s)) window.history.replaceState(null, '', caminho(s)); // caminho inválido ou com barra sobrando
  }, [pathname, doCaminho, caminho]);

  useEffect(() => {
    const h = window.location.hash.slice(1) as T;
    if (h && validas.includes(h)) { setSecao(h); window.history.replaceState(null, '', caminho(h)); }
  }, [validas, caminho]);

  const ir = useCallback((s: T) => {
    setSecao(s);
    if (window.location.pathname !== caminho(s)) window.history.pushState(null, '', caminho(s));
  }, [caminho]);

  return [secao, ir];
}
