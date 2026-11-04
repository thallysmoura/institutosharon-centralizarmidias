'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowLeft, BadgeCheck, Check, ChevronDown, CircleAlert, CircleCheck, Eye, EyeOff, IdCard, Lock, Mail, MapPin, ShieldCheck, User, X } from 'lucide-react';
import { api, Cidade } from '@/lib/api';
import { ehToque } from '@/lib/pwa';
import { pedirLocalizacao } from '@/lib/geo';
import PinModal from './PinModal';
import Spinner from './Spinner';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/;
const NOME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' .-]*$/;
const MAT_RE = /^[A-Za-z0-9._\-/]+$/;
const JSON_H = { 'Content-Type': 'application/json' };

const DESCARTAVEIS = ['mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'yopmail.com', 'trashmail.com', 'getnada.com', 'sharklasers.com', 'maildrop.cc', 'dispostable.com', 'fakeinbox.com'];
const ERROS_DOMINIO: Record<string, string> = { 'gmial.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmail.con': 'gmail.com', 'gmal.com': 'gmail.com', 'hotmial.com': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'outlok.com': 'outlook.com', 'outlook.con': 'outlook.com', 'yaho.com': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'gmail.com.br': 'gmail.com' };

type Campo = 'nome' | 'sobrenome' | 'email' | 'matricula' | 'cidade' | 'senha' | 'conf';

/** Capitaliza cada parte do nome ("maria da silva" vira "Maria da Silva"). */
const capitaliza = (t: string) => t.trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|[\s'-])([a-zà-ÿ])/g, (_, a, b) => a + b.toUpperCase()).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, (m) => m.toLowerCase());

function Rotulo({ id, children }: { id: string; children: React.ReactNode }) {
  return <label htmlFor={id} className="mb-1.5 block text-[0.78rem] font-semibold text-ink/75">{children}</label>;
}

/** Campo com ícone, estado de erro/sucesso e mensagem associada (acessível). */
const MSG_VERIFICAR = 'Verifique o e-mail com o código enviado.';

function Linha({ id, icone, erro, ok, dica, children, fim }: { id: string; icone: React.ReactNode; erro?: string; ok?: boolean; dica?: string; children: React.ReactNode; fim?: React.ReactNode }) {
  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/55" aria-hidden>{icone}</span>
        {children}
        {fim ?? (ok && !erro && <CircleCheck size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#22a35a]" aria-hidden />)}
      </div>
      <div id={`${id}-msg`} aria-live="polite">
        {erro ? <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-[0.8rem] font-medium leading-snug text-[#b3261e]"><CircleAlert size={14} className="mt-0.5 shrink-0" />{erro}</p> : dica ? <p className="mt-1.5 text-[0.78rem] leading-snug text-ink/55">{dica}</p> : null}
      </div>
    </div>
  );
}

/** Cadastro de aluno: e-mail verificado por PIN, matrícula, unidade e senha forte. */
export default function Cadastro({ onFechar, onConcluido }: { onFechar: () => void; onConcluido: (r: { logado: boolean; email: string; role: 'ALUNO' }) => void }) {
  const [v, setV] = useState({ nome: '', sobrenome: '', email: '', matricula: '', cidade: '', senha: '', conf: '' });
  const [tocado, setTocado] = useState<Partial<Record<Campo, boolean>>>({});
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [token, setToken] = useState('');
  const [verificado, setVerificado] = useState('');
  const [pinPara, setPinPara] = useState<string | null>(null);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [ver, setVer] = useState(false);
  const [caps, setCaps] = useState(false);
  const [busy, setBusy] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [pediu, setPediu] = useState(false);
  const posRef = useRef<[number, number] | null>(null);
  // Na última etapa já pede a localização, para entrar automaticamente ao concluir o cadastro.
  useEffect(() => { if (passo === 3) pedirLocalizacao().then((p) => { posRef.current = p; }).catch(() => null); }, [passo]);
  const [erro, setErro] = useState('');
  const [erroEmail, setErroEmail] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const set = (k: Campo) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setV((x) => ({ ...x, [k]: e.target.value })); setErro(''); if (k === 'email') setErroEmail(''); };
  const blur = (k: Campo) => () => setTocado((t) => ({ ...t, [k]: true }));

  useEffect(() => {
    api<Cidade[]>('/auth/cidades').then(setCidades).catch(() => null);
  }, []);

  const email = v.email.trim().toLowerCase();
  const dominio = email.split('@')[1] ?? '';
  const emailVerificado = !!token && verificado === email;
  const sugestao = ERROS_DOMINIO[dominio];

  const regras: [string, boolean][] = [
    ['Mínimo de 8 caracteres', v.senha.length >= 8],
    ['1 letra maiúscula', /[A-Z]/.test(v.senha)],
    ['1 número', /\d/.test(v.senha)],
    ['1 caractere especial (!@#$...)', /[^A-Za-z0-9]/.test(v.senha)],
    ['As duas senhas são iguais', v.senha.length > 0 && v.senha === v.conf],
  ];
  const senhaOk = regras.slice(0, 4).every(([, ok]) => ok);

  const erros: Partial<Record<Campo, string>> = {};
  if (!v.nome.trim()) erros.nome = 'Informe o nome.';
  else if (v.nome.trim().length < 2 || !NOME_RE.test(v.nome.trim())) erros.nome = 'Use apenas letras (mínimo 2).';
  if (!v.sobrenome.trim()) erros.sobrenome = 'Informe o sobrenome.';
  else if (v.sobrenome.trim().length < 2 || !NOME_RE.test(v.sobrenome.trim())) erros.sobrenome = 'Use apenas letras (mínimo 2).';
  if (!email) erros.email = 'Informe o e-mail.';
  else if (!EMAIL_RE.test(email)) erros.email = 'Digite um e-mail válido, como nome@dominio.com.';
  else if (DESCARTAVEIS.includes(dominio)) erros.email = 'E-mails temporários não são aceitos.';
  else if (!emailVerificado) erros.email = MSG_VERIFICAR;
  if (!v.matricula.trim()) erros.matricula = 'Informe a matrícula.';
  else if (v.matricula.trim().length < 3) erros.matricula = 'A matrícula deve ter ao menos 3 caracteres.';
  else if (!MAT_RE.test(v.matricula.trim())) erros.matricula = 'Use apenas letras, números e - . _ /';
  if (!v.cidade) erros.cidade = 'Selecione a unidade.';
  if (!v.senha) erros.senha = 'Crie uma senha.';
  else if (!senhaOk) erros.senha = 'A senha não atende a todos os requisitos.';
  if (!regras[4][1]) erros.conf = v.conf ? 'As senhas não coincidem.' : 'Confirme a senha.';
  // Pendência de verificação é informativa (cinza), não erro: não pinta o campo de vermelho.
  const mostra = (c: Campo) => { const m = tocado[c] ? erros[c] : undefined; return m === MSG_VERIFICAR ? undefined : m; };
  const ok = (c: Campo) => !erros[c] && !!v[c];

  async function pedirPin() {
    await api('/auth/cadastro/email/solicitar', { method: 'POST', headers: JSON_H, body: JSON.stringify({ email: v.email.trim(), nome: v.nome.trim() || undefined }) });
  }

  async function verificar() {
    setPediu(true);
    setTocado((t) => ({ ...t, email: true }));
    setErroEmail('');
    const e = erros.email;
    if (e && !e.startsWith('Verifique')) return;
    setEnviando(true);
    try {
      await pedirPin();
      setPinPara(v.email.trim());
    } catch (err) {
      setErroEmail((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const CAMPOS: Record<1 | 2 | 3, Campo[]> = { 1: ['nome', 'sobrenome', 'email'], 2: ['matricula', 'cidade'], 3: ['senha', 'conf'] };

  /** Marca os campos da etapa como tocados e devolve false (com foco no primeiro erro) se houver pendência. */
  function validarPasso(n: 1 | 2 | 3) {
    setTocado((t) => ({ ...t, ...Object.fromEntries(CAMPOS[n].map((c) => [c, true])) }));
    const primeiro = CAMPOS[n].find((c) => erros[c]);
    if (primeiro) {
      formRef.current?.querySelector<HTMLElement>(`#cad-${primeiro}`)?.focus();
      return false;
    }
    return true;
  }

  function voltar() {
    setErro('');
    if (passo === 1) onFechar();
    else setPasso((passo - 1) as 1 | 2);
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (passo < 3) {
      if (validarPasso(passo)) setPasso((passo + 1) as 2 | 3);
      return;
    }
    if (!validarPasso(3)) return;
    setBusy(true);
    try {
      const pos = posRef.current ?? (await pedirLocalizacao().catch(() => null));
      const r = await api<{ logado: boolean; role: 'ALUNO' }>('/auth/cadastro', {
        method: 'POST',
        headers: JSON_H,
        body: JSON.stringify({ nome: capitaliza(v.nome), sobrenome: capitaliza(v.sobrenome), email: v.email.trim(), token, matricula: v.matricula.trim().toUpperCase(), cidade_id: Number(v.cidade), senha: v.senha, ...(pos ? { lat: pos[0], lng: pos[1] } : {}) }),
      });
      onConcluido({ ...r, email: v.email.trim() });
    } catch (err) {
      setErro((err as Error).message);
      setBusy(false);
    }
  }

  const cls = (c: Campo) => `field !h-[2.9em] !rounded-[0.85em] !text-[1em] ${mostra(c) ? '!border-[#d9534f]' : ok(c) ? '!border-[#3aa56b]' : '!border-[#e4d9c5]'}`;
  const pad = { paddingLeft: '2.8rem' };
  const a11y = (c: Campo) => ({ 'aria-invalid': !!mostra(c), 'aria-describedby': `cad-${c}-msg` });

  const titulos = ['Seus dados', 'Matrícula e unidade', 'Crie sua senha'];

  return (
    <>
      <div>
        {passo > 1 && <button type="button" onClick={voltar} className="mb-3 inline-flex items-center gap-1.5 text-[0.85rem] font-semibold text-[#a9771a] hover:underline"><ArrowLeft size={16} />Voltar</button>}
        <header className="px-[0.5em] min-[1100px]:px-[0.72em]">
          <h2 className="font-sans whitespace-nowrap text-[2.05em] font-medium leading-[1] tracking-[-0.02em] text-[#33240F] min-[1100px]:text-[2.6em]">Criar{' '}<span className="font-bold" style={{ background: 'linear-gradient(180deg,#d6a431,#a8761a)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>conta</span></h2>
          <p className="mt-[0.7em] text-[0.95em] leading-snug text-[#6b5a3c]">Preencha os dados para começar</p>
        </header>

        <ol aria-label="Etapas do cadastro" className="mt-4 flex items-center gap-2">
          {titulos.map((t, i) => {
            const n = i + 1;
            const ativo = n === passo;
            const feito = n < passo;
            return (
              <li key={t} className={`flex items-center gap-2 ${n < 3 ? 'flex-1' : ''}`} aria-current={ativo ? 'step' : undefined}>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.75rem] font-bold transition ${ativo ? 'text-white shadow-[0_6px_14px_-6px_rgba(150,100,10,.7)]' : feito ? 'bg-[#e7f6ee] text-[#17794a]' : 'bg-[#f1e9d6] text-ink/45'}`} style={ativo ? { background: 'linear-gradient(180deg,#dcae3c,#a8761a)' } : undefined}>{feito ? <Check size={14} /> : n}</span>
                {n < 3 && <span className={`h-[2px] flex-1 rounded-full transition ${feito ? 'bg-[#3aa56b]' : 'bg-[#e8dcc3]'}`} />}
              </li>
            );
          })}
        </ol>

        <form ref={formRef} onSubmit={enviar} noValidate className="mt-4">
          <div className="space-y-4">
            {passo === 1 && (
              <>
                <div className="grid gap-4 min-[420px]:grid-cols-2">
                  <div>
                    <Rotulo id="cad-nome">Nome</Rotulo>
                    <Linha id="cad-nome" icone={<User size={18} />} erro={mostra('nome')} ok={ok('nome')}>
                      <input id="cad-nome" autoFocus={!ehToque()} suppressHydrationWarning autoComplete="given-name" value={v.nome} onChange={set('nome')} onBlur={() => { setV((x) => ({ ...x, nome: capitaliza(x.nome) })); blur('nome')(); }} placeholder="Maria" className={`${cls('nome')} pr-10`} style={pad} {...a11y('nome')} />
                    </Linha>
                  </div>
                  <div>
                    <Rotulo id="cad-sobrenome">Sobrenome</Rotulo>
                    <Linha id="cad-sobrenome" icone={<User size={18} />} erro={mostra('sobrenome')} ok={ok('sobrenome')}>
                      <input id="cad-sobrenome" autoComplete="family-name" value={v.sobrenome} onChange={set('sobrenome')} onBlur={() => { setV((x) => ({ ...x, sobrenome: capitaliza(x.sobrenome) })); blur('sobrenome')(); }} placeholder="Souza" className={`${cls('sobrenome')} pr-10`} style={pad} {...a11y('sobrenome')} />
                    </Linha>
                  </div>
                </div>
                <div>
                  <Rotulo id="cad-email">E-mail</Rotulo>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <Linha id="cad-email" icone={<Mail size={18} />} erro={erroEmail || (emailVerificado ? undefined : mostra('email'))} ok={emailVerificado} dica={emailVerificado ? undefined : tocado.email && erros.email === MSG_VERIFICAR ? MSG_VERIFICAR : !pediu ? undefined : 'Enviaremos um código de 4 números para confirmar.'}>
                        <input id="cad-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={v.email} onChange={set('email')} onBlur={blur('email')} placeholder="voce@email.com" className={`${cls('email')} pr-10 ${emailVerificado ? '!border-[#3aa56b]' : ''}`} style={pad} {...a11y('email')} />
                      </Linha>
                    </div>
                    {emailVerificado ? (
                      <span className="inline-flex h-[2.9em] shrink-0 items-center gap-1.5 rounded-[0.85em] bg-[#e7f6ee] px-3 text-[0.8rem] font-semibold text-[#17794a]"><BadgeCheck size={17} />Verificado</span>
                    ) : (
                      <button type="button" onClick={verificar} disabled={enviando || !EMAIL_RE.test(email)} className="btn btn-gold !h-[2.9em] !min-h-0 shrink-0 !rounded-[0.85em] !px-4 !text-[0.85em] disabled:!opacity-50">{enviando ? <Spinner /> : 'Verificar'}</button>
                    )}
                  </div>
                  {sugestao && !emailVerificado && (
                    <p className="mt-1.5 text-[0.8rem] text-ink/70">Você quis dizer <button type="button" onClick={() => setV((x) => ({ ...x, email: `${email.split('@')[0]}@${sugestao}` }))} className="font-semibold text-gold-700 underline underline-offset-2">{email.split('@')[0]}@{sugestao}</button>?</p>
                  )}
                  {emailVerificado && <p className="mt-1.5 text-[0.78rem] text-[#17794a]">E-mail confirmado. Se alterá-lo, será preciso verificar novamente.</p>}
                </div>
              </>
            )}

            {passo === 2 && (
              <>
                <div>
                  <Rotulo id="cad-matricula">Matrícula</Rotulo>
                  <Linha id="cad-matricula" icone={<IdCard size={18} />} erro={mostra('matricula')} ok={ok('matricula')}>
                    <input id="cad-matricula" autoFocus={!ehToque()} suppressHydrationWarning autoComplete="off" autoCapitalize="characters" value={v.matricula} onChange={set('matricula')} onBlur={blur('matricula')} placeholder="A0001" className={`${cls('matricula')} pr-10 uppercase`} style={pad} {...a11y('matricula')} />
                  </Linha>
                </div>
                <div>
                  <Rotulo id="cad-cidade">Unidade</Rotulo>
                  <Linha id="cad-cidade" icone={<MapPin size={18} />} erro={mostra('cidade')} fim={<ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink/55" aria-hidden />}>
                    <select id="cad-cidade" value={v.cidade} onChange={set('cidade')} onBlur={blur('cidade')} className={`${cls('cidade')} cursor-pointer appearance-none pr-10 ${v.cidade ? '' : '!text-ink/45'}`} style={pad} {...a11y('cidade')}>
                      <option value="">Selecione a unidade</option>
                      {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </Linha>
                </div>
              </>
            )}

            {passo === 3 && (
              <>
                <div>
                  <Rotulo id="cad-senha">Senha</Rotulo>
                  <Linha id="cad-senha" icone={<Lock size={18} />} erro={mostra('senha')} fim={<button type="button" onClick={() => setVer((x) => !x)} aria-label={ver ? 'Ocultar senhas' : 'Mostrar senhas'} className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center text-ink/70">{ver ? <EyeOff size={19} /> : <Eye size={19} />}</button>}>
                    <input id="cad-senha" autoFocus={!ehToque()} suppressHydrationWarning type={ver ? 'text' : 'password'} autoComplete="new-password" value={v.senha} onChange={set('senha')} onBlur={blur('senha')} onKeyUp={(e) => setCaps(e.getModifierState('CapsLock'))} placeholder="Crie uma senha" className={`${cls('senha')} pr-12`} style={pad} {...a11y('senha')} />
                  </Linha>
                  {caps && <p className="mt-1.5 text-[0.78rem] font-medium text-[#8a6a1c]">Caps Lock está ativado.</p>}
                </div>
                <div>
                  <Rotulo id="cad-conf">Confirmar senha</Rotulo>
                  <Linha id="cad-conf" icone={<Lock size={18} />} erro={mostra('conf')} ok={ok('conf')}>
                    <input id="cad-conf" type={ver ? 'text' : 'password'} autoComplete="new-password" value={v.conf} onChange={set('conf')} onBlur={blur('conf')} placeholder="Repita a senha" className={`${cls('conf')} pr-10`} style={pad} {...a11y('conf')} />
                  </Linha>
                </div>
                <ul className="space-y-1.5" aria-label="Requisitos da senha">
                  {regras.map(([t, certo]) => (
                    <li key={t} className={`flex items-center gap-2 text-[0.8rem] transition ${certo ? 'font-medium text-[#17794a]' : 'text-ink/55'}`}>
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${certo ? 'bg-[#e7f6ee]' : 'bg-sand'}`}>{certo && <Check size={13} />}</span>{t}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <footer className="mt-5 space-y-2.5">
            {erro && <p role="alert" className="flex items-start gap-2 rounded-xl bg-[#fdf0ee] px-4 py-2.5 text-[0.82rem] font-medium text-[#b3261e]"><CircleAlert size={16} className="mt-0.5 shrink-0" />{erro}</p>}
            <button type="submit" disabled={busy || (passo === 1 && !emailVerificado)} className="btn btn-gold w-full !h-[2.9em] !min-h-0 !rounded-[0.85em] !text-[1em] disabled:!opacity-50">
              {busy ? <><Spinner />Cadastrando...</> : passo < 3 ? 'Continuar' : 'Criar conta'}
            </button>
            {passo === 1 && <p className="mt-[5px] text-center text-[0.8rem] text-ink/60">Já tem conta? <button type="button" onClick={onFechar} className="font-semibold text-gold-700 underline underline-offset-2">Entrar</button></p>}
          </footer>
        </form>
      </div>

      {pinPara && (
        <PinModal
          email={pinPara}
          titulo={<>Verifique o seu <span className="text-gold-600">e-mail</span></>}
          onFechar={() => setPinPara(null)}
          onReenviar={pedirPin}
          onConfirmar={async (pin) => {
            const r = await api<{ token: string }>('/auth/cadastro/email/confirmar', { method: 'POST', headers: JSON_H, body: JSON.stringify({ email: pinPara, pin }) });
            setToken(r.token);
            setVerificado(pinPara.trim().toLowerCase());
            setPinPara(null);
          }}
        />
      )}
    </>
  );
}
