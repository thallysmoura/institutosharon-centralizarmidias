'use client';
import { FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, Eye, EyeOff, Lock, ShieldCheck, X } from 'lucide-react';
import { api, Me } from '@/lib/api';
import MsgErro from './MsgErro';
import PinModal from './PinModal';
import Spinner from './Spinner';

const JSON_H = { 'Content-Type': 'application/json' };
type Campo = 'atual' | 'nova' | 'conf';

/**
 * Alterar senha em 3 passos: (1) o servidor envia um código ao e-mail e a pessoa o digita; (2) só então abrem os campos
 * (senha atual, nova e confirmação, com a regra de 8+ caracteres, maiúscula, número e especial); (3) o servidor confere a
 * senha atual com bcrypt, grava a nova criptografada e avisa por e-mail.
 */
export default function AlterarSenha({ me }: { me: Me }) {
  const semSenhaAtual = me.origem === 'google'; // contas criadas pelo Google ainda não têm senha própria
  const [etapa, setEtapa] = useState<'fechado' | 'pin' | 'senha'>('fechado');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [ver, setVer] = useState(false);
  const [v, setV] = useState({ atual: '', nova: '', conf: '' });
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});

  const falha = (c: Campo, m: string) => setErros({ [c]: m });
  const limpar = (c: Campo) => setErros((x) => { if (!x[c]) return x; const r = { ...x }; delete r[c]; return r; });
  const set = (c: Campo) => (e: React.ChangeEvent<HTMLInputElement>) => { setV((x) => ({ ...x, [c]: e.target.value })); limpar(c); };

  const enviarPin = () => api('/perfil/senha/pin', { method: 'POST' });
  async function abrir() {
    setBusy(true);
    setMsg('');
    try { await enviarPin(); setEtapa('pin'); } catch (e) { setMsg((e as Error).message); setTimeout(() => setMsg(''), 5000); } finally { setBusy(false); }
  }

  const regras: [string, boolean][] = [
    ['Pelo menos 8 caracteres', v.nova.length >= 8],
    ['Uma letra maiúscula', /[A-Z]/.test(v.nova)],
    ['Um número', /\d/.test(v.nova)],
    ['Um caractere especial', /[^A-Za-z0-9]/.test(v.nova)],
  ];
  const forte = regras.every(([, c]) => c);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!semSenhaAtual && !v.atual) return falha('atual', 'Informe a senha atual.');
    if (!forte) return falha('nova', 'A nova senha ainda não atende todos os requisitos.');
    if (!semSenhaAtual && v.nova === v.atual) return falha('nova', 'A nova senha deve ser diferente da atual.');
    if (v.conf !== v.nova) return falha('conf', 'As senhas não conferem.');
    setErros({});
    setBusy(true);
    try {
      await api('/perfil/senha/alterar', { method: 'POST', headers: JSON_H, body: JSON.stringify({ ...(semSenhaAtual ? {} : { senhaAtual: v.atual }), novaSenha: v.nova }) });
      setEtapa('fechado');
      setV({ atual: '', nova: '', conf: '' });
      setOk(true);
      setTimeout(() => setOk(false), 7000);
    } catch (err) {
      const m = (err as Error).message;
      falha(/atual incorreta/i.test(m) ? 'atual' : /confirme o c/i.test(m) ? 'conf' : 'nova', m);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (etapa !== 'senha') return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) setEtapa('fechado'); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [etapa, busy]);

  const campo = (c: Campo, rotulo: string, auto: string) => (
    <div>
      <label htmlFor={`sn-${c}`} className={`flex items-center gap-3 rounded-xl border bg-white px-3.5 py-2.5 transition focus-within:border-[#c9a24a] focus-within:ring-4 focus-within:ring-[#c9a24a]/15 ${erros[c] ? 'border-[#d9534f]' : 'border-[#e4d9c5]'}`}>
        <Lock size={19} strokeWidth={1.7} className="shrink-0 text-[#b8902f]" aria-hidden />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#8a7a62]">{rotulo}</p>
          <input id={`sn-${c}`} type={ver ? 'text' : 'password'} autoComplete={auto} value={v[c]} onChange={set(c)} maxLength={100} className="w-full bg-transparent text-[1rem] font-medium text-[#33240F] outline-none" />
        </div>
        {(c === 'atual' || (semSenhaAtual && c === 'nova')) && <button type="button" onClick={() => setVer((x) => !x)} aria-label={ver ? 'Ocultar senhas' : 'Mostrar senhas'} className="shrink-0 text-[#b8902f]/80 hover:text-[#b8902f]">{ver ? <EyeOff size={19} /> : <Eye size={19} />}</button>}
      </label>
      <MsgErro texto={erros[c]} onSumir={() => limpar(c)} />
    </div>
  );

  return (
    <div className="mt-[1.1em]">
      {ok && <p role="status" className="fade-in mb-2 flex items-center gap-1.5 rounded-xl bg-[#e7f6ee] px-3 py-2 text-[0.85em] font-medium text-[#17794a]"><ShieldCheck size="1.1em" />Senha alterada com sucesso. Enviamos um aviso para o seu e-mail.</p>}
      <button type="button" onClick={abrir} disabled={busy} className="flex w-full items-center gap-[0.8em] rounded-[0.9em] border border-[#e4d9c5] bg-white/90 px-[1em] py-[0.85em] text-left transition hover:border-[#c9a24a]/70 disabled:opacity-70">
        <ShieldCheck size="1.3em" strokeWidth={1.7} className="shrink-0 text-[#b8902f]" aria-hidden />
        <span className="flex-1 leading-tight"><b className="block text-[0.95em] text-[#33240F]">Alterar senha</b><span className="text-[0.78em] text-[#8a7a62]">{semSenhaAtual ? 'Defina uma senha para entrar também com e-mail' : 'Confirmação por código enviado ao e-mail'}</span></span>
        {busy ? <Spinner /> : <ChevronRight size="1.2em" className="shrink-0 text-[#b8902f]" aria-hidden />}
      </button>
      <MsgErro texto={msg} onSumir={() => setMsg('')} />

      {etapa === 'pin' && (
        <PinModal
          email={me.email}
          titulo={<>Confirme que <span className="text-gold-600">é você</span></>}
          onFechar={() => setEtapa('fechado')}
          onReenviar={async () => { await enviarPin(); }}
          onConfirmar={async (pin) => { await api('/perfil/senha/verificar', { method: 'POST', headers: JSON_H, body: JSON.stringify({ pin }) }); setEtapa('senha'); }}
        />
      )}

      {etapa === 'senha' && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Nova senha" className="fade-in fixed inset-0 z-[120] flex items-end justify-center bg-black/55 sm:items-center sm:p-6">
          <form onSubmit={salvar} noValidate className="pop relative w-full max-w-[420px] rounded-t-3xl bg-[#fdfaf3] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl">
            <button type="button" onClick={() => setEtapa('fechado')} disabled={busy} aria-label="Fechar" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-ink/55 hover:bg-sand"><X size={19} /></button>
            <h2 className="pr-8 text-[1.5rem] font-bold leading-tight text-[#33240F]">Crie a sua <span className="text-gold-600">nova senha</span></h2>
            <p className="mt-1 text-[0.85rem] text-[#6b5a3c]">Código confirmado. Agora escolha uma senha segura.</p>
            <div className="mt-4 space-y-2.5">
              {!semSenhaAtual && campo('atual', 'Senha atual', 'current-password')}
              {campo('nova', 'Nova senha', 'new-password')}
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1 px-1 text-[0.76rem]" aria-label="Requisitos da senha">
                {regras.map(([t, c]) => (
                  <li key={t} className={`flex items-center gap-1.5 transition-colors ${c ? 'text-[#17794a]' : 'text-[#8a7a62]'}`}><span className={`grid h-4 w-4 place-items-center rounded-full transition ${c ? 'bg-[#3aa56b] text-white' : 'bg-[#eee5cf]'}`}>{c && <Check size={11} strokeWidth={3} />}</span>{t}</li>
                ))}
              </ul>
              {campo('conf', 'Confirmar nova senha', 'new-password')}
            </div>
            <button type="submit" disabled={busy} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[1rem] font-semibold text-white transition active:scale-[.985] disabled:opacity-70" style={{ background: 'linear-gradient(180deg,#c9a24a,#a67c26)' }}>{busy ? <><Spinner />Salvando...</> : 'Alterar senha'}</button>
          </form>
        </div>,
        document.body,
      )}
    </div>
  );
}
