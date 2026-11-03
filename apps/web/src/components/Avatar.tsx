'use client';
import { useRef, useState } from 'react';
import { Camera, User } from 'lucide-react';
import { API, api } from '@/lib/api';
import Spinner from './Spinner';

/** Foto de perfil (Google ou enviada). Com `editavel`, o clique abre a seleção de imagem e envia como nova foto. */
export default function Avatar({ foto, size = 64, editavel = false, onMudou }: { foto: string | null; size?: number; editavel?: boolean; onMudou?: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [falhou, setFalhou] = useState(false);

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

  const corpo = (
    <span className="relative block shrink-0" style={{ width: size, height: size }}>
      {foto && !falhou ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`${API}${foto}`} alt="Foto de perfil" referrerPolicy="no-referrer" onError={() => setFalhou(true)} className="h-full w-full rounded-full object-cover ring-2 ring-white shadow-card" />
      ) : (
        <span className="grid h-full w-full place-items-center rounded-full bg-[#f6efe0] text-gold-600"><User size={size * 0.5} /></span>
      )}
      {busy && <span className="absolute inset-0 grid place-items-center rounded-full bg-white/70 text-gold-600"><Spinner size={Math.max(18, size * 0.3)} /></span>}
      {editavel && !busy && (
        <span className="absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full border-2 border-white text-white shadow-card" style={{ background: 'linear-gradient(180deg,#c9a24a,#a67c26)' }}>
          <Camera size={14} />
        </span>
      )}
    </span>
  );

  if (!editavel) return corpo;
  return (
    <span className="inline-flex flex-col items-center">
      <button type="button" onClick={() => input.current?.click()} aria-label="Alterar foto de perfil" title="Alterar foto de perfil" className="rounded-full">{corpo}</button>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { enviar(e.target.files?.[0]); e.target.value = ''; }} />
      {erro && <span role="alert" className="mt-1 max-w-[140px] text-center text-[0.7rem] font-medium text-[#b3261e]">{erro}</span>}
    </span>
  );
}
