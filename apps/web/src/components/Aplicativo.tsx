'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, ChevronDown, Copy, Download, Link2, MessageCircle, MessageSquareText, QrCode, Share2, Smartphone } from 'lucide-react';
import Titulo from './Titulo';
import { useInstalar } from '@/lib/pwa';

const PASSOS = [
  'Aponte a câmera do celular para o QR Code.',
  'Abra o link no navegador do celular. No iPhone: Compartilhar → Adicionar à Tela de Início.',
  'Entre com seu e-mail e senha e permita a localização.',
  'Pronto: é só enviar as fotos dos atendimentos.',
];

const BTN = 'inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl px-3 text-[0.88rem] font-semibold transition active:scale-[0.98]';
const SEC = `${BTN} border border-[#e4d9c5] bg-white text-[#33240F] hover:bg-ivory`;

/** QR code de acesso ao sistema (endereço atual do site) com compartilhar, copiar link e baixar imagem. */
export default function Aplicativo() {
  const [link, setLink] = useState('');
  const [qr, setQr] = useState('');
  const [copiado, setCopiado] = useState(false);
  const instalar = useInstalar();
  const [nativo, setNativo] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!menu) return;
    const fora = (e: Event) => { if (!(e.target as HTMLElement).closest('[data-compartilhar]')) setMenu(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', fora); document.addEventListener('touchstart', fora); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('touchstart', fora); document.removeEventListener('keydown', esc); };
  }, [menu]);

  useEffect(() => {
    const url = `${window.location.origin}/login`;
    setLink(url);
    setNativo(typeof navigator.share === 'function');
    QRCode.toDataURL(url, { width: 640, margin: 1, color: { dark: '#33240F', light: '#ffffff' } }).then(setQr).catch(() => null);
  }, []);

  async function copiar() {
    try { await navigator.clipboard.writeText(link); } catch {
      const t = document.createElement('textarea'); t.value = link; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  /** Compartilha o link pela folha nativa (WhatsApp, Instagram, SMS...); sem suporte, copia. */
  async function compartilharLink() {
    setMenu(false);
    if (!nativo) return copiar();
    try { await navigator.share({ title: 'Fotos Clínicas - Instituto Sharon', text: 'Acesse o sistema de Fotos Clínicas do Instituto Sharon:', url: link }); } catch { /* cancelado */ }
  }

  /** Compartilha a imagem do QR Code; sem suporte a arquivos, baixa a imagem. */
  async function compartilharQr() {
    setMenu(false);
    try {
      const blob = await (await fetch(qr)).blob();
      const arquivo = new File([blob], 'qrcode-instituto-sharon.png', { type: 'image/png' });
      if (nativo && navigator.canShare?.({ files: [arquivo] })) { await navigator.share({ files: [arquivo], title: 'QR Code - Fotos Clínicas', text: `Acesse: ${link}` }); return; }
    } catch (e) { if ((e as Error).name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = qr; a.download = 'qrcode-instituto-sharon.png'; a.click();
  }
  const texto = encodeURIComponent(`Acesse o sistema de Fotos Clínicas do Instituto Sharon: ${link}`);

  return (
    <div className="mt-5 grid min-w-0 gap-4 sm:mt-6 sm:gap-5 lg:grid-cols-[minmax(0,400px)_1fr]">
      <section className="card flex min-w-0 flex-col items-center p-4 sm:p-6">
        <div className="w-full max-w-[260px] rounded-2xl border border-[#eadfc9] bg-white p-3 shadow-[0_14px_30px_-20px_rgba(120,80,20,.45)]">
          {qr ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={qr} alt="QR Code de acesso ao sistema" className="aspect-square w-full" /> : <div className="aspect-square w-full animate-pulse rounded-lg bg-sand" />}
        </div>

        <button type="button" onClick={copiar} aria-label="Copiar link" className="mt-3 flex w-full max-w-full items-center gap-2 rounded-xl bg-[#f6efe0] px-3 py-2.5 text-left transition hover:bg-[#f1e7cf]">
          <span className="min-w-0 flex-1 truncate text-[0.8rem] font-medium text-muted">{link || '...'}</span>
          {copiado ? <Check size={16} className="shrink-0 text-[#17794a]" /> : <Copy size={16} className="shrink-0 text-[#a67c26]" />}
        </button>

        <div className="mt-3 flex w-full flex-col gap-2.5">
          <div data-compartilhar className="relative">
            <button type="button" onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu} disabled={!qr} className={`${BTN} text-white shadow-[0_12px_24px_-12px_rgba(43,28,16,.7)] disabled:opacity-60`} style={{ background: 'linear-gradient(180deg,#3a2616,#33240F)' }}>
              <Share2 size={18} className="text-[#e7b23c]" />Compartilhar<ChevronDown size={16} className={`text-white/70 transition ${menu ? 'rotate-180' : ''}`} />
            </button>
            {menu && (
              <div role="menu" className="pop absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-[#e4d9c5] bg-white py-1.5 shadow-[0_18px_40px_-14px_rgba(60,40,10,.45)]">
                <button type="button" role="menuitem" onClick={compartilharQr} className="flex w-full items-center gap-3 px-4 py-3 text-left text-[0.92rem] font-medium transition hover:bg-ivory"><QrCode size={19} className="text-gold-600" />QR Code<span className="ml-auto text-[0.72rem] font-normal text-ink/45">imagem</span></button>
                <button type="button" role="menuitem" onClick={compartilharLink} className="flex w-full items-center gap-3 px-4 py-3 text-left text-[0.92rem] font-medium transition hover:bg-ivory"><Link2 size={19} className="text-gold-600" />Link do aplicativo</button>
                {!nativo && (
                  <>
                    <div className="mx-3 my-1 border-t border-line" />
                    <a role="menuitem" href={`https://wa.me/?text=${texto}`} target="_blank" rel="noopener noreferrer" onClick={() => setMenu(false)} className="flex w-full items-center gap-3 px-4 py-3 text-[0.92rem] font-medium transition hover:bg-ivory"><MessageCircle size={19} className="text-[#17794a]" />WhatsApp</a>
                    <a role="menuitem" href={`sms:?&body=${texto}`} onClick={() => setMenu(false)} className="flex w-full items-center gap-3 px-4 py-3 text-[0.92rem] font-medium transition hover:bg-ivory"><MessageSquareText size={19} className="text-[#35547c]" />SMS</a>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={copiar} className={SEC}>{copiado ? <Check size={16} className="text-[#17794a]" /> : <Copy size={16} className="text-[#a67c26]" />}{copiado ? 'Copiado' : 'Copiar link'}</button>
            <a href={qr || undefined} download="qrcode-instituto-sharon.png" aria-disabled={!qr} className={SEC}><Download size={16} className="text-[#a67c26]" />Baixar QR</a>
          </div>
          {instalar && <button type="button" onClick={instalar} className={`${BTN} text-white`} style={{ background: 'linear-gradient(180deg,#c9a24a,#a67c26)' }}><Smartphone size={17} />Instalar neste dispositivo</button>}
        </div>
      </section>

      <section className="card min-w-0 p-4 sm:p-6">
        <Titulo nivel={3} icone={Smartphone}>Como acessar</Titulo>
        <ol className="mt-4 space-y-3.5">
          {PASSOS.map((t, i) => (
            <li key={t} className="flex items-start gap-3 text-[0.9rem] leading-snug text-ink/80">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#f6efe0] text-[0.75rem] font-bold text-gold-700">{i + 1}</span>
              <span className="min-w-0 pt-0.5">{t}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
