'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ChevronDown, EllipsisVertical, Share, SquarePlus, X } from 'lucide-react';
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

/** Convite para instalar o app no celular: botão direto quando o navegador permite e passo a passo (iPhone, Android sem prompt) quando não. */
export default function InstalarApp() {
  const instalar = useInstalar();
  const naAreaAluno = usePathname()?.startsWith('/aluno'); // há barra de navegação inferior: sobe o aviso acima dela
  const [plat, setPlat] = useState<Plataforma>('outro');
  const [pronto, setPronto] = useState(false);
  const [aberto, setAberto] = useState(true);
  const [semPrompt, setSemPrompt] = useState(false);

  useEffect(() => {
    if (!ehToque() || instalado() || adiado()) return;
    setPlat(detectar());
    const t = setTimeout(() => setPronto(true), 2500);
    const f = setTimeout(() => setSemPrompt(true), 5000); // Android: se o navegador não ofereceu o prompt, mostra o passo a passo
    const ok = () => { adiar(3650); setAberto(false); };
    window.addEventListener('appinstalled', ok);
    return () => { clearTimeout(t); clearTimeout(f); window.removeEventListener('appinstalled', ok); };
  }, []);

  if (!pronto || !aberto) return null;
  if (plat === 'outro') return null;

  const fechar = () => { adiar(ADIAR_DIAS); setAberto(false); };
  const direto = !!instalar && plat !== 'ios';
  if (plat === 'android' && !direto && !semPrompt) return null;

  return (
    <div role="dialog" aria-label="Instalar aplicativo" className={`pop fixed inset-x-3 z-[45] mx-auto max-w-[440px] ${naAreaAluno ? 'bottom-[calc(env(safe-area-inset-bottom)+4.75rem)]' : 'bottom-[max(0.75rem,env(safe-area-inset-bottom))]'}`}>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#33240F] p-4 text-white shadow-[0_22px_50px_-18px_rgba(33,24,13,.85)]">
        <button type="button" onClick={fechar} aria-label="Fechar" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-white/60 hover:bg-white/10"><X size={17} /></button>
        <div className="flex items-start gap-3 pr-6">
          <Image src="/icons/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-xl" />
          <div className="min-w-0 leading-snug">
            <p className="text-[0.98rem] font-semibold">Instale o app Fotos Clínicas</p>
            <p className="mt-0.5 text-[0.82rem] text-white/70">Tela cheia e acesso direto da tela inicial, como um aplicativo.</p>
          </div>
        </div>

        {direto && (
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={async () => { await instalar(); }} className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl text-[0.92rem] font-semibold text-[#21180D] active:scale-[0.98]" style={{ background: 'linear-gradient(180deg,#e7b23c,#c9a24a)' }}>Instalar</button>
            <button type="button" onClick={fechar} className="min-h-[44px] rounded-xl px-4 text-[0.85rem] font-medium text-white/70 hover:bg-white/10">Agora não</button>
          </div>
        )}

        {plat === 'ios' && (
          <>
            <ol className="mt-3 space-y-2 rounded-xl bg-white/[0.07] p-3 text-[0.85rem]">
              <li className="flex items-center gap-2.5"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#e7b23c] text-[0.72rem] font-bold text-[#21180D]">1</span>Toque em <Share size={18} className="mx-0.5 shrink-0 text-[#e7b23c]" aria-label="Compartilhar" /> na barra do navegador</li>
              <li className="flex items-center gap-2.5"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#e7b23c] text-[0.72rem] font-bold text-[#21180D]">2</span>Escolha <SquarePlus size={18} className="mx-0.5 shrink-0 text-[#e7b23c]" aria-hidden /> <b>Adicionar à Tela de Início</b></li>
            </ol>
            <div className="mt-2 flex items-center justify-between text-[0.78rem] text-white/55">
              <button type="button" onClick={fechar} className="min-h-[36px] font-medium hover:text-white">Agora não</button>
              <span className="inline-flex animate-bounce items-center gap-1"><ChevronDown size={16} className="text-[#e7b23c]" aria-hidden />barra abaixo</span>
            </div>
          </>
        )}

        {plat === 'android' && !direto && (
          <>
            <ol className="mt-3 space-y-2 rounded-xl bg-white/[0.07] p-3 text-[0.85rem]">
              <li className="flex items-center gap-2.5"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#e7b23c] text-[0.72rem] font-bold text-[#21180D]">1</span>Toque no menu <EllipsisVertical size={18} className="mx-0.5 shrink-0 text-[#e7b23c]" aria-label="Menu" /> do navegador</li>
              <li className="flex items-center gap-2.5"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#e7b23c] text-[0.72rem] font-bold text-[#21180D]">2</span><span>Escolha <b>Instalar aplicativo</b> ou <b>Adicionar à tela inicial</b></span></li>
            </ol>
            <button type="button" onClick={fechar} className="mt-2 min-h-[36px] text-[0.78rem] font-medium text-white/55 hover:text-white">Agora não</button>
          </>
        )}

        {plat === 'webview' && (
          <>
            <p className="mt-3 rounded-xl bg-white/[0.07] p-3 text-[0.85rem]">Você está num navegador interno (WhatsApp, Instagram...). Toque em <EllipsisVertical size={16} className="mx-0.5 inline text-[#e7b23c]" aria-hidden /> e escolha <b>Abrir no navegador</b> (Chrome ou Safari) para instalar.</p>
            <button type="button" onClick={fechar} className="mt-2 min-h-[36px] text-[0.78rem] font-medium text-white/55 hover:text-white">Agora não</button>
          </>
        )}
      </div>
    </div>
  );
}
