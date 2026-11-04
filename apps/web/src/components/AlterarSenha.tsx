'use client';
import { FormEvent, useState } from 'react';
import { ChevronDown, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { api, Me } from '@/lib/api';
import MsgErro from './MsgErro';
import PinModal from './PinModal';
import Spinner from './Spinner';

const PILULA = 'flex items-center gap-[0.8em] rounded-[0.9em] border bg-white/90 px-[1em] py-[0.6em] shadow-[inset_0_1px_2px_rgba(60,40,10,.04)] transition focus-within:border-[#c9a24a] focus-within:ring-4 focus-within:ring-[#c9a24a]/15';
const JSON_H = { 'Content-Type': 'application/json' };
type Campo = 'atual' | 'nova' | 'conf';

/** Alterar senha: senha atual, nova e confirmação; depois um PIN enviado ao e-mail da conta. Ao concluir, o servidor avisa por e-mail que a senha mudou. */
export default function AlterarSenha({ me }: { me: Me }) {
  const semSenhaAtual = me.origem === 'google'; // contas criadas pelo Google ainda não têm senha própria
  const [aberto, setAberto] = useState(false);
  const [v, setV] = useState({ atual: '', nova: '', conf: '' });
  const [ver, setVer] = useState(false);
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState(false);
  const [ok, setOk] = useState(false);

  const falha = (c: Campo, m: string) => setErros({ [c]: m });
  const limpar = (c: Campo) => setErros((x) => { if (!x[c]) return x; const r = { ...x }; delete r[c]; return r; });
  const set = (c: Campo) => (e: React.ChangeEvent<HTMLInputElement>) => { setV((x) => ({ ...x, [c]: e.target.value })); limpar(c); };

  const solicitar = () => api('/perfil/senha/solicitar', { method: 'POST', headers: JSON_H, body: JSON.stringify({ ...(semSenhaAtual ? {} : { senhaAtual: v.atual }), novaSenha: v.nova }) });

  async function continuar(e: FormEvent) {
    e.preventDefault();
    if (!semSenhaAtual && !v.atual) return falha('atual', 'Informe a senha atual.');
    if (v.nova.length < 8) return falha('nova', 'A senha deve ter ao menos 8 caracteres.');
    if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/.test(v.nova)) return falha('nova', 'Use 1 letra maiúscula, 1 número e 1 caractere especial.');
    if (!semSenhaAtual && v.nova === v.atual) return falha('nova', 'A nova senha deve ser diferente da atual.');
    if (v.conf !== v.nova) return falha('conf', 'As senhas não conferem.');
    setErros({});
    setBusy(true);
    try {
      await solicitar();
      setPin(true);
    } catch (err) {
      const m = (err as Error).message;
      falha(/atual incorreta/i.test(m) ? 'atual' : 'nova', m);
    } finally {
      setBusy(false);
    }
  }

  function concluido() {
    setPin(false);
    setAberto(false);
    setV({ atual: '', nova: '', conf: '' });
    setOk(true);
    setTimeout(() => setOk(false), 7000);
  }

  const campo = (c: Campo, rotulo: string, auto: string) => (
    <div>
      <label htmlFor={`sn-${c}`} className={`${PILULA} ${erros[c] ? 'border-[#d9534f]' : 'border-[#e4d9c5]'}`}>
        <Lock size="1.3em" strokeWidth={1.7} className="shrink-0 text-[#b8902f]" aria-hidden />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[0.68em] font-semibold uppercase tracking-[0.14em] text-[#8a7a62]">{rotulo}</p>
          <input id={`sn-${c}`} type={ver ? 'text' : 'password'} autoComplete={auto} value={v[c]} onChange={set(c)} maxLength={100} className="w-full bg-transparent text-[1em] font-medium text-[#33240F] outline-none" />
        </div>
        {c === 'atual' || (semSenhaAtual && c === 'nova') ? (
          <button type="button" onClick={() => setVer((x) => !x)} aria-label={ver ? 'Ocultar senhas' : 'Mostrar senhas'} className="shrink-0 text-[#b8902f]/80 hover:text-[#b8902f]">{ver ? <EyeOff size="1.2em" /> : <Eye size="1.2em" />}</button>
        ) : null}
      </label>
      <MsgErro texto={erros[c]} onSumir={() => limpar(c)} />
    </div>
  );

  return (
    <div className="mt-[1.1em]">
      {ok && <p role="status" className="fade-in mb-2 flex items-center gap-1.5 rounded-xl bg-[#e7f6ee] px-3 py-2 text-[0.85em] font-medium text-[#17794a]"><ShieldCheck size="1.1em" />Senha alterada com sucesso. Enviamos um aviso para o seu e-mail.</p>}
      <button type="button" onClick={() => setAberto((x) => !x)} aria-expanded={aberto} className="flex w-full items-center gap-[0.8em] rounded-[0.9em] border border-[#e4d9c5] bg-white/90 px-[1em] py-[0.85em] text-left transition hover:border-[#c9a24a]/70">
        <ShieldCheck size="1.3em" strokeWidth={1.7} className="shrink-0 text-[#b8902f]" aria-hidden />
        <span className="flex-1 leading-tight"><b className="block text-[0.95em] text-[#33240F]">Alterar senha</b><span className="text-[0.78em] text-[#8a7a62]">{semSenhaAtual ? 'Defina uma senha para entrar também com e-mail' : 'Confirmação por código enviado ao e-mail'}</span></span>
        <ChevronDown size="1.2em" className={`shrink-0 text-[#b8902f] transition ${aberto ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {aberto && (
        <form onSubmit={continuar} noValidate className="fade-in mt-[0.7em] space-y-[0.7em]">
          {!semSenhaAtual && campo('atual', 'Senha atual', 'current-password')}
          {campo('nova', 'Nova senha', 'new-password')}
          {campo('conf', 'Confirmar nova senha', 'new-password')}
          <button type="submit" disabled={busy} className="mt-[0.4em] flex h-[3em] w-full items-center justify-center gap-[0.6em] rounded-[0.85em] text-[1em] font-semibold text-white transition active:scale-[.985] disabled:opacity-70" style={{ background: 'linear-gradient(180deg,#c9a24a,#a67c26)' }}>{busy ? <><Spinner />Enviando código...</> : 'Continuar'}</button>
        </form>
      )}

      {pin && (
        <PinModal
          email={me.email}
          titulo={<>Confirme a <span className="text-gold-600">nova senha</span></>}
          onFechar={() => setPin(false)}
          onReenviar={async () => { await solicitar(); }}
          onConfirmar={async (p) => { await api('/perfil/senha/confirmar', { method: 'POST', headers: JSON_H, body: JSON.stringify({ pin: p }) }); concluido(); }}
        />
      )}
    </div>
  );
}
