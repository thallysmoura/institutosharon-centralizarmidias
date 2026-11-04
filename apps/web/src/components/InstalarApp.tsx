'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { EllipsisVertical, Share, SquarePlus, X } from 'lucide-react';
import { ehToque, useInstalar } from '@/lib/pwa';

const CHAVE = 'sharon_instalar_ate';
const ADIAR_DIAS = 3;

type Plataforma = 'ios' | 'android' | 'outro' | 'webview';

function detectar(): Plataforma {
  const ua = navigator.userAgent;
  if (/FBAN|FBAV|Instagram|Line\/|WhatsApp|Messenger|MiuiBrowser.*XiaoMi/i.test(ua)) return 'webview';
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'outro';
}

const instalado = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const adiado = () => { try { return Number(localStorage.getItem(CHAVE) ?? 0) > Date.now(); } catch { return false; } };
const adiar = (dias: number) => { try { localStorage.setItem(CHAVE, String(Date.now() + dias * 864e5)); } catch { /* sem armazenamento */ } };

/** Convite discreto para instalar o app: um cartão com o botão Instalar; quando o navegador não instala sozinho, abre uma orientação curta. */
export default function InstalarApp() {
  const instalar = useInstalar();
  const naAreaAluno = usePathname()?.startsWith('/aluno'); // há barra de navegação inferior: sobe o aviso acima dela
  const [plat, setPlat] = useState<Plataforma>('outro');
  const [pronto, setPronto] = useState(false);
  const [aberto, setAberto] = useState(true);
  const [guia, setGuia] = useState(false);

  useEffect(() => {
    if (!ehToque() || instalado() || adiado()) return;
    setPlat(detectar());
    const t = setTimeout(() => setPronto(true), 2500);
    const ok = () => { adiar(3650); setAberto(false); };
    window.addEventListener('appinstalled', ok);
    return () => { clearTimeout(t); window.removeEventListener('appinstalled', ok); };
  }, []);

  useEffect(() => {
    if (!guia) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setGuia(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [guia]);

  if (!pronto || !aberto || plat === 'outro') return null;

  const fechar = () => { adiar(ADIAR_DIAS); setAberto(false); setGuia(false); };
  const aoInstalar = async () => {
    if (instalar && plat !== 'ios') { await instalar(); return; }
    setGuia(true);
  };

  const passo = (n: number, texto: React.ReactNode) => (
    <li className="flex items-start gap-3 text-[0.92rem] leading-snug text-[#33240F]"><span className="mt-px grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#f6efe0] text-[0.75rem] font-bold text-[#a67c26]">{n}</span><span>{texto}</span></li>
  );

  return (
    <>
      <div role="dialog" aria-label="Instalar aplicativo" className={`pop fixed inset-x-3 z-[45] mx-auto max-w-[420px] ${naAreaAluno ? 'bottom-[calc(env(safe-area-inset-bottom)+4.75rem)]' : 'bottom-[max(0.75rem,env(safe-area-inset-bottom))]'}`}>
        <div className="flex items-center gap-3 rounded-2xl border border-[#e8dfca] bg-white/95 p-3 pr-2 shadow-[0_16px_40px_-18px_rgba(33,24,13,.45)] backdrop-blur">
          <Image src="/icons/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[0.92rem] font-semibold text-[#33240F]">Instalar aplicativo</p>
            <p className="truncate text-[0.76rem] text-[#8a7a62]">Acesso rápido na tela inicial</p>
          </div>
          <button type="button" onClick={aoInstalar} className="inline-flex min-h-[38px] shrink-0 items-center rounded-lg px-4 text-[0.85rem] font-semibold text-white active:scale-[0.97]" style={{ background: 'linear-gradient(180deg,#c9a24a,#a67c26)' }}>Instalar</button>
          <button type="button" onClick={fechar} aria-label="Fechar" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#8a7a62] hover:bg-[#f6efe0]"><X size={16} /></button>
        </div>
      </div>

      {guia && (
        <div role="dialog" aria-modal="true" aria-label="Como instalar" className="fixed inset-0 z-[130] flex items-end justify-center bg-black/45 p-3 sm:items-center" onClick={() => setGuia(false)}>
          <div className="pop w-full max-w-[380px] rounded-3xl bg-[#fdfaf3] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <Image src="/icons/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 rounded-xl" />
            <h2 className="mt-3 text-[1.25rem] font-bold text-[#33240F]">Instalar aplicativo</h2>
            <ol className="mt-4 space-y-3.5">
              {plat === 'ios' && (
                <>
                  {passo(1, <>Toque em <Share size={17} className="mx-0.5 inline text-[#a67c26]" aria-hidden /> <b>Compartilhar</b>, na barra do Safari.</>)}
                  {passo(2, <>Escolha <SquarePlus size={17} className="mx-0.5 inline text-[#a67c26]" aria-hidden /> <b>Adicionar à Tela de Início</b>.</>)}
                </>
              )}
              {plat === 'android' && (
                <>
                  {passo(1, <>Toque no menu <EllipsisVertical size={17} className="mx-0.5 inline text-[#a67c26]" aria-hidden /> do navegador.</>)}
                  {passo(2, <>Escolha <b>Instalar aplicativo</b> ou <b>Adicionar à tela inicial</b>.</>)}
                </>
              )}
              {plat === 'webview' && (
                <>
                  {passo(1, <>Toque no menu <EllipsisVertical size={17} className="mx-0.5 inline text-[#a67c26]" aria-hidden /> deste navegador.</>)}
                  {passo(2, <>Escolha <b>Abrir no navegador</b> (Chrome ou Safari) e instale por lá.</>)}
                </>
              )}
            </ol>
            <button type="button" onClick={() => setGuia(false)} className="mt-6 flex h-12 w-full items-center justify-center rounded-xl text-[0.95rem] font-semibold text-white" style={{ background: 'linear-gradient(180deg,#c9a24a,#a67c26)' }}>Entendi</button>
          </div>
        </div>
      )}
    </>
  );
}
