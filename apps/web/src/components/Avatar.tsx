'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ChevronLeft, Download, ChevronRight, ImagePlus, Maximize2, Minus, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { API, api } from '@/lib/api';
import Spinner from './Spinner';

/** Silhueta padrão do perfil (cabeça e ombros) em dourado do Instituto. */
function Silhueta({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
      <defs>
        <linearGradient id="sil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d9a936" /><stop offset="1" stopColor="#a8761a" /></linearGradient>
      </defs>
      <circle cx="24" cy="17" r="7.2" fill="none" stroke="url(#sil)" strokeWidth="2.6" />
      <path d="M9.5 40c.9-7.4 6.4-11.6 14.5-11.6S37.6 32.6 38.5 40" fill="none" stroke="url(#sil)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/** Visualizador com zoom (botões, roda do mouse, duplo clique) e arraste da imagem ampliada. */
export function Ampliada({ src, onFechar, nav, baixar, excluir, video }: { video?: boolean; src: string; onFechar: () => void; nav?: { atual: number; total: number; ir: (i: number) => void }; baixar?: string; excluir?: () => void }) {
  const [pronta, setPronta] = useState(false); // controles só aparecem depois que a imagem é exibida
  const [z, setZ] = useState(1);
  const [p, setP] = useState({ x: 0, y: 0 });
  const arrasto = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const ajusta = (n: number) => { const v = Math.min(4, Math.max(1, n)); setZ(v); if (v === 1) setP({ x: 0, y: 0 }); };

  useEffect(() => { setZ(1); setP({ x: 0, y: 0 }); setPronta(false); }, [src]); // nova foto: volta ao tamanho original
  const vai = (d: number) => { if (nav && nav.total > 1) nav.ir((nav.atual + d + nav.total) % nav.total); };

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); if (e.key === 'ArrowRight') vai(1); if (e.key === 'ArrowLeft') vai(-1); if (e.key === '+' || e.key === '=') setZ((v) => Math.min(4, v + 0.5)); if (e.key === '-') setZ((v) => Math.max(1, v - 0.5)); };
    document.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFechar, nav?.atual, nav?.total]);

  const btn = 'grid h-11 w-11 place-items-center rounded-full bg-white/12 text-white backdrop-blur-sm transition hover:bg-white/25 disabled:opacity-40';
  return (
    <div role="dialog" aria-modal="true" aria-label="Foto ampliada" className="fixed inset-0 z-[120] flex flex-col bg-[#120d06]/92 backdrop-blur-sm" onClick={onFechar}>
      {pronta && (
        <>
          {nav && nav.total > 1 && <span className="absolute left-4 top-[max(1.25rem,env(safe-area-inset-top))] z-10 rounded-full bg-white/12 px-3 py-1.5 text-sm font-semibold tabular-nums text-white/90 backdrop-blur-sm">{nav.atual + 1} / {nav.total}</span>}
          <button type="button" onClick={(e) => { e.stopPropagation(); onFechar(); }} aria-label="Fechar" title="Fechar (Esc)" className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-10 grid h-11 w-11 place-items-center rounded-full bg-white text-[#33240F] shadow-[0_8px_24px_-8px_rgba(0,0,0,.6)] transition hover:scale-105 hover:bg-[#f6efe0] sm:h-12 sm:w-12"><X size={22} strokeWidth={2.2} /></button>
        </>
      )}
      <div
        className="pop relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 pt-16 sm:px-10"
        onWheel={(e) => ajusta(z + (e.deltaY < 0 ? 0.3 : -0.3))}
        onPointerMove={(e) => { if (arrasto.current && z > 1) setP({ x: arrasto.current.px + e.clientX - arrasto.current.x, y: arrasto.current.py + e.clientY - arrasto.current.y }); }}
        onPointerUp={() => { arrasto.current = null; }}
        onPointerLeave={() => { arrasto.current = null; }}
      >
        {pronta && nav && nav.total > 1 && (
          <>
            <button type="button" onClick={(e) => { e.stopPropagation(); vai(-1); }} aria-label="Foto anterior" className={`${btn} absolute left-3 z-10 sm:left-6`}><ChevronLeft size={24} /></button>
            <button type="button" onClick={(e) => { e.stopPropagation(); vai(1); }} aria-label="Próxima foto" className={`${btn} absolute right-3 z-10 sm:right-6`}><ChevronRight size={24} /></button>
          </>
        )}
        {!pronta && <span className="absolute inset-0 grid place-items-center text-[#e7b23c]"><Spinner size={34} /></span>}
        {video && (
          <video
            key={src}
            src={src}
            controls
            autoPlay
            playsInline
            onLoadedData={() => setPronta(true)}
            onError={() => setPronta(true)}
            onClick={(e) => e.stopPropagation()}
            className={`${pronta ? 'opacity-100' : 'opacity-0'} max-h-[calc(100dvh-11rem)] max-w-full rounded-2xl bg-black transition-opacity duration-300`}
          />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {!video && <img
          src={src}
          alt="Foto ampliada"
          onLoad={() => setPronta(true)}
          onError={() => setPronta(true)}
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={() => ajusta(z > 1 ? 1 : 2.5)}
          onPointerDown={(e) => { if (z > 1) { arrasto.current = { x: e.clientX, y: e.clientY, px: p.x, py: p.y }; (e.target as HTMLElement).setPointerCapture(e.pointerId); } }}
          className={`${pronta ? 'opacity-100' : 'opacity-0'} max-h-[calc(100dvh-11rem)] max-w-full select-none rounded-2xl object-contain transition-opacity duration-300 shadow-[0_30px_80px_-30px_rgba(0,0,0,.8)] ${z > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
          style={{ transform: `translate(${p.x}px, ${p.y}px) scale(${z})`, transition: arrasto.current ? 'none' : 'transform .2s ease', touchAction: 'none' }}
        />}
      </div>
      <div className={`${pronta ? 'fade-in' : 'invisible'} flex items-center justify-center gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4`} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => ajusta(z - 0.5)} disabled={z <= 1} aria-label="Reduzir" className={btn}><Minus size={20} /></button>
        <span className="min-w-[3.5rem] text-center text-sm font-semibold tabular-nums text-white/85">{Math.round(z * 100)}%</span>
        <button type="button" onClick={() => ajusta(z + 0.5)} disabled={z >= 4} aria-label="Ampliar" className={btn}><Plus size={20} /></button>
        <button type="button" onClick={() => ajusta(1)} disabled={z === 1} aria-label="Restaurar tamanho" className={btn}><RotateCcw size={18} /></button>
        {excluir && <button type="button" onClick={excluir} aria-label="Excluir foto" title="Excluir foto" className={`${btn} !bg-[#b3261e]/80 hover:!bg-[#b3261e]`}><Trash2 size={19} /></button>}
        {baixar && <a href={baixar} download aria-label="Baixar foto" title="Baixar foto" className={btn}><Download size={19} /></a>}
      </div>
    </div>
  );
}

/** Foto de perfil (Google ou enviada). Com `editavel`, o clique abre um menu: ampliar, enviar/trocar e excluir a foto. */
export default function Avatar({ foto, size = 64, editavel = false, onMudou, semBorda = false }: { foto: string | null; size?: number; editavel?: boolean; onMudou?: () => void; semBorda?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const raiz = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [falhou, setFalhou] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirma, setConfirma] = useState(false);
  const [zoom, setZoom] = useState(false);
  const tem = !!foto && !falhou;

  useEffect(() => {
    if (!menu) return;
    const fora = (e: MouseEvent) => { const t = e.target as Node; if (!raiz.current?.contains(t) && !menuRef.current?.contains(t)) { setMenu(false); setConfirma(false); } };
    const fecha = () => { setMenu(false); setConfirma(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(false); setConfirma(false); } };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    window.addEventListener('resize', fecha);
    window.addEventListener('scroll', fecha, true);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); window.removeEventListener('resize', fecha); window.removeEventListener('scroll', fecha, true); };
  }, [menu]);

  async function enviar(f?: File) {
    if (!f) return;
    setErro('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return setErro('Use JPEG, PNG ou WebP.');
    if (f.size > 5 * 1024 * 1024) return setErro('Máximo de 5 MB.');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('foto', f);
      await api('/perfil/foto', { method: 'POST', body: fd });
      setFalhou(false);
      onMudou?.();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function excluir() {
    setMenu(false);
    setConfirma(false);
    setErro('');
    setBusy(true);
    try {
      await api('/perfil/foto', { method: 'DELETE' });
      setFalhou(false);
      onMudou?.();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const corpo = (
    <span className="relative block shrink-0" style={{ width: size, height: size }}>
      {tem ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`${API}${foto}`} alt="Foto de perfil" referrerPolicy="no-referrer" onError={() => setFalhou(true)} className={`h-full w-full rounded-full object-cover ${semBorda ? '' : 'ring-2 ring-white shadow-card'}`} />
      ) : (
        <span className="grid h-full w-full place-items-center rounded-full bg-[#f6efe0] ring-2 ring-white"><Silhueta size={size * 0.62} /></span>
      )}
      {busy && <span className="absolute inset-0 grid place-items-center rounded-full bg-white/70 text-gold-600"><Spinner size={Math.max(18, size * 0.3)} /></span>}
      {editavel && !busy && (
        <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-[2.5px] border-white text-white shadow-[0_6px_14px_-6px_rgba(120,80,10,.7)] transition group-hover:scale-110" style={{ background: 'linear-gradient(180deg,#dcae3c,#a8761a)' }}>
          <Camera size={15} strokeWidth={1.9} />
        </span>
      )}
    </span>
  );

  if (!editavel) return corpo;

  const item = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[0.88rem] font-medium text-[#33240F] transition hover:bg-[#f6efe0]';
  return (
    <span ref={raiz} className="relative inline-flex flex-col items-center">
      <button type="button" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPos({ top: r.bottom + 12, left: Math.min(Math.max(8, r.left + r.width / 2 - 100), window.innerWidth - 208) }); setMenu((m) => !m); }} aria-haspopup="menu" aria-expanded={menu} aria-label="Opções da foto de perfil" className="group rounded-full outline-none focus-visible:ring-4 focus-visible:ring-[#c9a24a]/30">{corpo}</button>
      {menu && createPortal(
        <div ref={menuRef} role="menu" className="pop fixed z-[130] w-[200px] rounded-xl border border-[#e4d9c5] bg-white p-1.5 shadow-[0_20px_40px_-18px_rgba(90,60,10,.45)]" style={{ top: pos.top, left: pos.left, transformOrigin: 'top center' }}>
          {tem && <button type="button" role="menuitem" onClick={() => { setMenu(false); setZoom(true); }} className={item}><Maximize2 size={16} className="text-[#b8902f]" />Ampliar</button>}
          <button type="button" role="menuitem" onClick={() => { setMenu(false); input.current?.click(); }} className={item}><ImagePlus size={16} className="text-[#b8902f]" />{tem ? 'Trocar foto' : 'Enviar foto'}</button>
          {tem && (confirma ? (
            <div className="rounded-lg bg-[#fdf0ee] p-2">
              <p className="px-1 pb-1.5 text-[0.78rem] font-medium text-[#b3261e]">Excluir a foto de perfil?</p>
              <div className="flex gap-1.5">
                <button type="button" onClick={excluir} className="flex-1 rounded-md bg-[#b3261e] px-2 py-1.5 text-[0.78rem] font-semibold text-white">Excluir</button>
                <button type="button" onClick={() => setConfirma(false)} className="flex-1 rounded-md bg-white px-2 py-1.5 text-[0.78rem] font-semibold text-ink/70">Cancelar</button>
              </div>
            </div>
          ) : (
            <button type="button" role="menuitem" onClick={() => setConfirma(true)} className={`${item} !text-[#b3261e] hover:!bg-[#fdf0ee]`}><Trash2 size={16} />Excluir foto</button>
          ))}
        </div>
      , document.body)}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { enviar(e.target.files?.[0]); e.target.value = ''; }} />
      {erro && <span role="alert" className="mt-1 max-w-[160px] text-center text-[0.7rem] font-medium text-[#b3261e]">{erro}</span>}
      {zoom && tem && createPortal(<Ampliada src={`${API}${foto}`} onFechar={() => setZoom(false)} />, document.body)}
    </span>
  );
}
