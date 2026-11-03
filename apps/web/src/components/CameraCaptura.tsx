'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Check, RefreshCw, RotateCcw, TriangleAlert, X } from 'lucide-react';

type Props = { total: number; max: number; onFoto: (f: File) => void; onFechar: () => void; onNativo: () => void };
type Previa = { file: File; url: string; largura: number; altura: number; aviso: string };

const LIMITE_BYTES = 9.5 * 1048576; // o servidor aceita até 10 MB por foto

/** Android/Chrome tem captura de foto em resolução total do sensor (ImageCapture); iPhone usa o quadro de vídeo em 4K. */
const temImageCapture = () => typeof window !== 'undefined' && 'ImageCapture' in window;

/** Avalia nitidez (variância do laplaciano) e brilho numa miniatura: avisa sem bloquear. */
async function avaliar(blob: Blob): Promise<{ largura: number; altura: number; aviso: string }> {
  const bmp = await createImageBitmap(blob);
  const w = 192;
  const h = Math.max(1, Math.round((bmp.height / bmp.width) * w));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { largura: bmp.width, altura: bmp.height, aviso: '' };
  ctx.drawImage(bmp, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const g = new Float32Array(w * h);
  let soma = 0;
  for (let i = 0; i < w * h; i++) { g[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]; soma += g[i]; }
  const brilho = soma / (w * h);
  let acc = 0, acc2 = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const l = 4 * g[y * w + x] - g[y * w + x - 1] - g[y * w + x + 1] - g[(y - 1) * w + x] - g[(y + 1) * w + x];
    acc += l; acc2 += l * l; n++;
  }
  const variancia = n ? acc2 / n - (acc / n) ** 2 : 0;
  const aviso = brilho < 45 ? 'Foto escura: procure mais luz.' : brilho > 225 ? 'Foto muito clara: reduza o reflexo.' : variancia < 18 ? 'A foto pode estar tremida ou fora de foco.' : '';
  const dim = { largura: bmp.width, altura: bmp.height };
  bmp.close?.();
  return { ...dim, aviso };
}

/**
 * Câmera dentro do app: pede a permissão nativa na 1ª vez (o navegador guarda a escolha), captura em alta resolução,
 * mostra uma revisão da foto (com aviso de nitidez/brilho) antes de aceitar e permite várias fotos seguidas.
 */
export default function CameraCaptura({ total, max, onFoto, onFechar, onNativo }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const fotoRef = useRef(onFoto);
  const nativoRef = useRef(onNativo);
  const fecharRef = useRef(onFechar);
  fotoRef.current = onFoto;
  nativoRef.current = onNativo;
  fecharRef.current = onFechar;
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [estado, setEstado] = useState<'pedindo' | 'ok' | 'negada'>('pedindo');
  const [flash, setFlash] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const [previa, setPrevia] = useState<Previa | null>(null);

  const parar = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };

  const iniciar = useCallback(async (modo: 'environment' | 'user') => {
    parar();
    setEstado('pedindo');
    // Com ImageCapture a prévia pode ser leve (1080p) e a foto sai em resolução total; sem ele, pede 4K do vídeo.
    const alta = !temImageCapture();
    const video_: MediaTrackConstraints = { facingMode: { ideal: modo }, width: { ideal: alta ? 3840 : 1920 }, height: { ideal: alta ? 2160 : 1080 }, frameRate: { ideal: 30 } };
    try {
      let s: MediaStream;
      try { s = await navigator.mediaDevices.getUserMedia({ video: video_, audio: false }); }
      catch (e) { if ((e as DOMException).name === 'OverconstrainedError') s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: modo }, audio: false }); else throw e; }
      stream.current = s;
      // foco/exposição contínuos quando o aparelho permite (ignora se não houver suporte)
      s.getVideoTracks()[0]?.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => null);
      if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => null); }
      setEstado('ok');
    } catch (e) {
      const nome = (e as DOMException).name;
      if (nome === 'NotAllowedError' || nome === 'SecurityError') setEstado('negada');
      else nativoRef.current(); // sem câmera acessível pelo navegador: usa a câmera do aparelho
    }
  }, []);

  useEffect(() => { iniciar(facing); return parar; }, [facing, iniciar]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fecharRef.current(); };
    document.addEventListener('keydown', esc);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = antes; };
  }, []);
  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa.url); }, [previa]);

  async function tirar() {
    const v = video.current;
    if (!v || !v.videoWidth || total >= max || capturando) return;
    setCapturando(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 120);
    navigator.vibrate?.(30);
    try {
      let blob: Blob | null = null;
      const track = stream.current?.getVideoTracks()[0];
      if (track && temImageCapture()) {
        try {
          const IC = (window as unknown as { ImageCapture: new (t: MediaStreamTrack) => { takePhoto: () => Promise<Blob> } }).ImageCapture;
          const b = await new IC(track).takePhoto();
          if (b.size <= LIMITE_BYTES) blob = b;
        } catch { /* usa o quadro do vídeo */ }
      }
      if (!blob) {
        const c = document.createElement('canvas');
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        c.getContext('2d')?.drawImage(v, 0, 0);
        blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.92));
      }
      if (!blob) return;
      const info = await avaliar(blob);
      setPrevia({ file: new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }), url: URL.createObjectURL(blob), ...info });
    } finally {
      setCapturando(false);
    }
  }

  const usar = () => { if (!previa) return; fotoRef.current(previa.file); setPrevia(null); };
  const refazer = () => setPrevia(null);
  const contados = total;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Câmera" className="fixed inset-0 z-[70] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onFechar} aria-label="Fechar câmera" className="grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/20"><X size={22} /></button>
        <span className="rounded-full bg-white/10 px-3 py-1 text-[0.78rem] font-semibold">{contados}/{max}</span>
        <button type="button" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} disabled={!!previa} aria-label="Trocar câmera" className="grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"><RefreshCw size={20} /></button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video ref={video} playsInline muted autoPlay className="h-full w-full object-cover" />
        {flash && <div className="pointer-events-none absolute inset-0 bg-white/80" aria-hidden />}
        {estado === 'pedindo' && <p className="absolute inset-0 grid place-items-center px-8 text-center text-[0.9rem] text-white/80">Permita o uso da câmera quando o navegador perguntar.</p>}
        {estado === 'negada' && (
          <div className="absolute inset-0 grid place-items-center bg-black/80 px-8 text-center">
            <div>
              <Camera size={34} className="mx-auto text-[#e7b23c]" aria-hidden />
              <p className="mt-3 text-[1rem] font-semibold">Câmera bloqueada</p>
              <p className="mt-1 text-[0.85rem] leading-snug text-white/70">Toque no cadeado ao lado do endereço do site e permita a câmera. Ou use a câmera do aparelho.</p>
              <button type="button" onClick={onNativo} className="btn btn-gold mt-4 !min-h-[46px]">Usar câmera do aparelho</button>
              <button type="button" onClick={() => iniciar(facing)} className="mt-2 block min-h-[40px] w-full text-[0.85rem] font-medium text-white/70 hover:text-white">Tentar de novo</button>
            </div>
          </div>
        )}

        {previa && (
          <div className="absolute inset-0 flex flex-col bg-black" role="group" aria-label="Revisar foto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previa.url} alt="Foto tirada" className="min-h-0 flex-1 object-contain" />
            <div className="shrink-0 px-5 pb-1 pt-3 text-center">
              <p className="text-[0.72rem] text-white/55">{previa.largura} × {previa.altura} px · {(previa.file.size / 1048576).toFixed(1)} MB</p>
              {previa.aviso && <p role="status" className="mx-auto mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[#e7b23c]/20 px-3 py-1 text-[0.8rem] font-medium text-[#f3d98b]"><TriangleAlert size={14} />{previa.aviso}</p>}
              {!previa.aviso && <p className="mt-1.5 text-[0.8rem] font-medium text-[#8fd9aa]">Foto nítida. Confira e use.</p>}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        {previa ? (
          <>
            <button type="button" onClick={refazer} className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-white/10 text-[0.95rem] font-semibold hover:bg-white/20"><RotateCcw size={18} />Refazer</button>
            <button type="button" onClick={usar} className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl text-[0.95rem] font-semibold text-[#21180D]" style={{ background: 'linear-gradient(180deg,#e7b23c,#c9a24a)' }}><Check size={18} />Usar foto</button>
          </>
        ) : (
          <>
            <span className="w-24" />
            <button type="button" onClick={tirar} disabled={estado !== 'ok' || contados >= max || capturando} aria-label="Tirar foto" className="grid h-[74px] w-[74px] place-items-center rounded-full border-4 border-white transition active:scale-95 disabled:opacity-40">
              <span className="h-[58px] w-[58px] rounded-full bg-white" />
            </button>
            <button type="button" onClick={onFechar} disabled={total === 0} className="inline-flex min-h-[44px] w-24 items-center justify-center gap-1.5 rounded-full text-[0.85rem] font-semibold text-[#21180D] disabled:opacity-0" style={{ background: 'linear-gradient(180deg,#e7b23c,#c9a24a)' }}><Check size={16} />Concluir</button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
