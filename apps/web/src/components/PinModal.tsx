'use client';
import { ClipboardEvent, KeyboardEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MailCheck, X } from 'lucide-react';
import Spinner from './Spinner';

/** Confirmação por PIN de 4 dígitos enviado ao novo e-mail: avança sozinho a cada número, aceita colar o código e confirma ao completar. */
export default function PinModal({ email, titulo, topo, aviso, onConfirmar, onReenviar, onFechar }: { email: string; titulo?: ReactNode; topo?: ReactNode; aviso?: string; onConfirmar: (pin: string) => Promise<void>; onReenviar: () => Promise<void>; onFechar: () => void }) {
  const [d, setD] = useState(['', '', '', '']);
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  const [espera, setEspera] = useState(60);
  const [info, setInfo] = useState(aviso ?? '');
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { refs.current[0]?.focus(); }, []);
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onFechar();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onFechar]);

  const confirmar = useCallback(async (pin: string) => {
    setBusy(true);
    setErro('');
    try {
      await onConfirmar(pin);
    } catch (e) {
      setErro((e as Error).message);
      setD(['', '', '', '']);
      setBusy(false);
      setTimeout(() => refs.current[0]?.focus(), 30);
    }
  }, [onConfirmar]);

  function preencher(valor: string, ini: number) {
    const nums = valor.replace(/\D/g, '').slice(0, 4 - ini).split('');
    if (!nums.length) return;
    const novo = [...d];
    nums.forEach((n, i) => { novo[ini + i] = n; });
    setD(novo);
    setErro('');
    const prox = ini + nums.length;
    if (novo.every(Boolean)) { refs.current[3]?.blur(); confirmar(novo.join('')); } else refs.current[Math.min(prox, 3)]?.focus();
  }

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const novo = [...d];
      if (novo[i]) novo[i] = ''; else if (i > 0) { novo[i - 1] = ''; refs.current[i - 1]?.focus(); }
      setD(novo);
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < 3) refs.current[i + 1]?.focus();
  }

  function aoColar(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    preencher(e.clipboardData.getData('text'), 0);
  }

  async function reenviar() {
    setErro('');
    setInfo('');
    try {
      await onReenviar();
      setEspera(60);
      setInfo('Novo código enviado.');
      setD(['', '', '', '']);
      refs.current[0]?.focus();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  // Portal no body: o card de login usa backdrop-blur, que prende elementos fixed dentro dele.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="pin-t" className="fixed inset-0 z-[100] flex items-stretch justify-center bg-ink/60 sm:items-center sm:p-6 sm:backdrop-blur-sm" onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} className="relative flex h-[100dvh] w-full flex-col justify-center bg-ivory px-6 py-10 text-center sm:h-auto sm:max-w-[420px] sm:rounded-[24px] sm:p-9 sm:shadow-soft">
        <button type="button" onClick={onFechar} aria-label="Fechar" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-ink/60 hover:bg-sand"><X size={18} /></button>
        {topo}
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#f6efe0] text-gold-600"><MailCheck size={26} /></span>
        <h2 id="pin-t" className="mt-4 text-[1.9rem] font-bold">{titulo ?? <>Confirme o seu <span className="text-gold-600">e-mail</span></>}</h2>
        <p className="mt-2 text-[0.9rem] text-ink/65">Enviamos um código de 4 números para<br /><strong className="break-all text-ink">{email}</strong></p>

        <div className="mt-6 flex justify-center gap-3">
          {d.map((v, i) => (
            <input key={i} ref={(el) => { refs.current[i] = el; }} value={v} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} pattern="[0-9]*" maxLength={4} disabled={busy}
              aria-label={`Dígito ${i + 1}`} onChange={(e) => preencher(e.target.value, i)} onKeyDown={(e) => aoTeclar(e, i)} onPaste={aoColar} onFocus={(e) => e.target.select()}
              className={`h-16 w-14 rounded-2xl border bg-white text-center text-[1.8rem] font-bold outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25 sm:h-[68px] sm:w-[60px] ${erro ? 'border-[#d9534f]' : 'border-line'}`} />
          ))}
        </div>

        <div className="mt-4 min-h-[44px]" aria-live="polite">
          {busy && <p className="flex items-center justify-center gap-2 text-sm text-gold-700"><Spinner size={18} />Aguarde...</p>}
          {!busy && erro && <p role="alert" className="text-[0.85rem] font-medium text-[#b3261e]">{erro}</p>}
          {!busy && !erro && info && <p className="text-[0.85rem] font-medium text-[#17794a]">{info}</p>}
        </div>

        <button type="button" onClick={reenviar} disabled={espera > 0 || busy} className="btn btn-line mx-auto mt-1 !min-h-[44px] !px-6 !text-[0.88rem]">
          {espera > 0 ? `Reenviar código em ${String(Math.floor(espera / 60)).padStart(1, '0')}:${String(espera % 60).padStart(2, '0')}` : 'Reenviar código'}
        </button>
        <p className="mt-1 text-[0.72rem] text-ink/40">Dica: você pode copiar e colar o código recebido.</p>
      </div>
    </div>
    , document.body);
}
