'use client';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, Download, History, ImageIcon, Info, Pencil, PlusCircle, Trash2, User, Camera, Play, Video } from 'lucide-react';
import { api, Atendimento, fmtData, fotoUrl } from '@/lib/api';
import { fmtDia } from '@/lib/session';
import Titulo from '@/components/Titulo';
import { Ampliada } from '@/components/Avatar';
import CameraCaptura from '@/components/CameraCaptura';
import { ehVideo, fmtDur, MAX_GRAVACAO_S, MAX_VIDEO_BYTES, MAX_VIDEOS, metaDe, prepararVideo, TIPOS_VIDEO } from '@/lib/midia';

type Item = { file: File; url: string; video?: boolean; thumb?: string; dur?: number };
const liberar = (i: Item) => { URL.revokeObjectURL(i.url); if (i.thumb) URL.revokeObjectURL(i.thumb); };
export type MeusEnviosHandle = { abrirMenu: () => void };

const MAX = 10;
const MAX_BYTES = 10 * 1024 * 1024;
const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Envio de fotos e histórico do próprio usuário (aluno ou administrador): grade, detalhes, editar paciente,
 * excluir (só some para quem enviou), câmera do app e envio do dispositivo. `abrirMenu()` abre as opções de Novo envio.
 */
const MeusEnvios = forwardRef<MeusEnviosHandle, { modo: 'recentes' | 'historico'; semLista?: boolean; onTotal?: (n: number) => void; onVerTodos?: () => void }>(function MeusEnvios({ modo, semLista, onTotal, onVerTodos }, ref) {
  const [menuNovo, setMenuNovo] = useState(false);
  const aberturaMenu = useRef(0);
  // Abre o menu de envio; um toque "fantasma" logo após abrir (ao trocar de aba) não pode fechá-lo.
  const abrirMenuNovo = () => { aberturaMenu.current = Date.now(); setMenuNovo(true); };
  const [camAberta, setCamAberta] = useState(false);
  const [camModo, setCamModo] = useState<'foto' | 'video'>('foto');
  const cameraVideo = useRef<HTMLInputElement>(null);
  const [det, setDet] = useState<number | null>(null); // posição na grade da foto aberta no modal
  const [editando, setEditando] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [erroNome, setErroNome] = useState('');
  const [ver, setVer] = useState<{ a: Atendimento; i: number } | null>(null);
  const [apagar, setApagar] = useState<number | null>(null); // id da foto em confirmação de exclusão
  const [apagando, setApagando] = useState(false);
  const [ident, setIdent] = useState('');
  const [itens, setItens] = useState<Item[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [meus, setMeus] = useState<Atendimento[]>([]);
  const galeria = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const identRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(() => api<Atendimento[]>('/atendimentos/meus').then(setMeus).catch(() => null), []);
  useEffect(() => { carregar(); }, [carregar]);

  async function adicionar(lista: FileList | File[] | null) {
    if (!lista) return;
    const novos: Item[] = [];
    let aviso = '';
    let nVideos = itens.filter((i) => i.video).length;
    let bytesVideos = itens.filter((i) => i.video).reduce((t, i) => t + i.file.size, 0);
    for (const f of Array.from(lista)) {
      if (itens.length + novos.length >= MAX) { aviso = `Máximo de ${MAX} arquivos por envio.`; break; }
      if (ehVideo(f)) {
        if (f.type && !TIPOS_VIDEO.includes(f.type)) aviso = 'Use vídeos MP4, MOV ou WebM.';
        else if (nVideos >= MAX_VIDEOS) aviso = `Máximo de ${MAX_VIDEOS} vídeos por envio.`;
        else if (bytesVideos + f.size > MAX_VIDEO_BYTES) aviso = 'Os vídeos passam de 90 MB. Grave um vídeo mais curto ou envie em partes.';
        else {
          const m = metaDe(f) ?? (await prepararVideo(f));
          if (m.duracao > MAX_GRAVACAO_S + 0.5) { aviso = `Cada vídeo pode ter no máximo ${MAX_GRAVACAO_S} segundos.`; continue; }
          nVideos++;
          bytesVideos += f.size;
          novos.push({ file: f, url: URL.createObjectURL(f), video: true, thumb: m.poster ? URL.createObjectURL(m.poster) : undefined, dur: m.duracao });
        }
      } else if (!TIPOS.includes(f.type)) aviso = 'Use fotos JPEG, PNG ou WebP, ou vídeos MP4, MOV ou WebM.';
      else if (f.size > MAX_BYTES) aviso = 'Cada foto deve ter no máximo 10 MB.';
      else novos.push({ file: f, url: URL.createObjectURL(f) });
    }
    setItens((v) => [...v, ...novos]);
    setMsg(aviso ? { ok: false, texto: aviso } : null);
  }

  const remover = (i: number) => setItens((v) => { liberar(v[i]); return v.filter((_, k) => k !== i); });

  async function enviar() {
    setEnviando(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('identificador', ident.trim());
      itens.filter((i) => !i.video).forEach((i) => fd.append('fotos', i.file));
      const vids = itens.filter((i) => i.video);
      vids.forEach((i, k) => {
        fd.append('videos', i.file);
        const m = metaDe(i.file);
        if (m?.poster) fd.append('posters', m.poster, `${k}.jpg`);
      });
      if (vids.length) fd.append('duracoes', JSON.stringify(vids.map((i) => Math.round((metaDe(i.file)?.duracao ?? 0) * 10) / 10)));
      const r = await api<{ enviadas: number }>('/atendimentos', { method: 'POST', body: fd });
      itens.forEach(liberar);
      setItens([]);
      setMsg({ ok: true, texto: `${r.enviadas} arquivo(s) enviado(s) com sucesso.` });
      carregar();
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message || 'Não foi possível enviar. Tente novamente.' });
    } finally {
      setEnviando(false);
    }
  }

  useEffect(() => {
    if (!msg?.ok) return;
    const t = setTimeout(() => setMsg(null), 5000);
    return () => clearTimeout(t);
  }, [msg]);
  useEffect(() => {
    if (!menuNovo) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuNovo(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [menuNovo]);

  const cancelarEnvio = () => { itens.forEach(liberar); setItens([]); setIdent(''); setMsg(null); };
  const pronto = ident.trim().length >= 2 && itens.length > 0 && !enviando;

  // Todas as fotos (mais novas primeiro), cada uma com o atendimento a que pertence.
  const todas = meus.flatMap((a) => a.fotos.map((f) => ({ a, f })));
  const grade = modo === 'recentes' ? todas.slice(0, 12) : todas;
  const atual = det != null ? todas[det] : null;

  function abrirDetalhe(id: number) {
    setDet(todas.findIndex((x) => x.f.id === id));
    setEditando(false);
    setErroNome('');
  }
  async function salvarNome() {
    if (!atual) return;
    const nome = novoNome.trim();
    if (nome.length < 2) return setErroNome('Informe ao menos 2 caracteres.');
    setSalvandoNome(true);
    setErroNome('');
    try {
      await api(`/atendimentos/${atual.a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identificador: nome }) });
      await carregar();
      setEditando(false);
    } catch (e) {
      setErroNome((e as Error).message);
    } finally {
      setSalvandoNome(false);
    }
  }
  const tam = (b?: number) => (!b ? '-' : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);

  const painelEnvios = (
    <section key={modo} className={`fade-in flex min-h-0 flex-1 flex-col rounded-2xl border border-line bg-white p-4 shadow-card lg:col-span-2 lg:p-5`}>
      <div className="flex shrink-0 items-center justify-between">
        <Titulo icone={History}>{modo === 'recentes' ? 'Recentes' : 'Histórico de envios'}</Titulo>
        <div className="flex shrink-0 items-center gap-3">
          {modo === 'recentes' && meus.length > 0 && <button type="button" onClick={() => onVerTodos?.()} className="text-[0.8rem] font-semibold text-gold-600">Ver todos ({meus.length})</button>}
        </div>
      </div>
      {msg?.ok && <p role="status" className="pop mt-3 flex items-center gap-2 rounded-xl bg-[#e7f6ee] px-3 py-2.5 text-[0.82rem] font-medium text-[#17794a]"><CheckCircle2 size={16} className="shrink-0" />{msg.texto}</p>}
      {meus.length === 0 ? (
        <div className="grid flex-1 place-items-center text-center text-[0.85rem] text-ink/50">
          <div><span className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full bg-[#f6efe0] text-gold-600"><ImageIcon size={20} /></span>Nenhum envio ainda.<br />Toque em <b>Novo envio</b> para começar.</div>
        </div>
      ) : (
        <ul className="mt-4 grid min-h-0 flex-1 grid-cols-3 content-start gap-2 overflow-y-auto sm:grid-cols-4 sm:gap-3 lg:grid-cols-5 xl:grid-cols-6">
          {grade.map(({ a, f }) => (
            <li key={f.id}>
              <button type="button" onClick={() => abrirDetalhe(f.id)} aria-label={`Ver foto de ${a.identificador_paciente}`} className="group relative block aspect-square w-full overflow-hidden rounded-xl bg-sand shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fotoUrl(f.id, true)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                {f.tipo === 'video' && <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[0.62rem] font-semibold text-white backdrop-blur-sm"><Play size={10} fill="currentColor" />{fmtDur(f.duracao) || 'Vídeo'}</span>}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-5 text-left text-white">
                  <span className="block truncate text-[0.72rem] font-semibold">{a.identificador_paciente}</span>
                  <span className="block truncate text-[0.62rem] text-white/80">{fmtDia(f.created_at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  /** Detalhes da foto: informações, editar nome do paciente, baixar e excluir (só some para o aluno). */
  const modalDetalhe = atual && (
    <div role="dialog" aria-modal="true" aria-label="Detalhes da foto" className="fade-in fixed inset-0 z-[60] flex bg-black/55 sm:items-center sm:justify-center sm:p-6" onClick={() => setDet(null)}>
      <div className="pop flex h-full w-full flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[94dvh] sm:max-w-[860px] sm:rounded-3xl sm:shadow-2xl lg:flex-row" onClick={(e) => e.stopPropagation()}>
        <div className="relative h-[44dvh] shrink-0 bg-[#21180D] lg:h-auto lg:min-h-[340px] lg:flex-1">
          <button type="button" onClick={() => setDet(null)} aria-label="Fechar" className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/70"><X size={20} /></button>
          {atual.f.tipo === 'video'
            ? <video key={atual.f.id} src={fotoUrl(atual.f.id)} poster={fotoUrl(atual.f.id, true)} controls playsInline className="h-full w-full bg-black object-contain" />
            : (
          <button type="button" onClick={() => setVer({ a: atual.a, i: Math.max(0, atual.a.fotos.findIndex((x) => x.id === atual.f.id)) })} aria-label="Ampliar foto" className="block h-full w-full cursor-zoom-in">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotoUrl(atual.f.id)} alt="" className="h-full w-full object-contain" />
          </button>
            )}
          {todas.length > 1 && (
            <>
              <button type="button" aria-label="Anterior" onClick={() => { setDet((det! - 1 + todas.length) % todas.length); setEditando(false); }} className="absolute left-2 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-2xl text-white backdrop-blur-sm">‹</button>
              <button type="button" aria-label="Próxima" onClick={() => { setDet((det! + 1) % todas.length); setEditando(false); }} className="absolute right-2 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-2xl text-white backdrop-blur-sm">›</button>
            </>
          )}
        </div>
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:w-[330px] lg:flex-none lg:shrink-0">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[1.15rem] font-bold leading-tight">Detalhes da foto</h2>
          </div>

          <div className="mt-4">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-ink/50">Paciente</p>
            {editando ? (
              <div className="mt-1">
                <input autoFocus value={novoNome} onChange={(e) => setNovoNome(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') salvarNome(); if (e.key === 'Escape') setEditando(false); }} maxLength={80} aria-label="Nome do paciente" className="field !h-[46px]" />
                <p className="mt-1.5 text-[0.72rem] text-ink/55">Altera o nome em todas as fotos deste atendimento.</p>
                {erroNome && <p role="alert" className="mt-1.5 text-[0.78rem] font-medium text-[#b3261e]">{erroNome}</p>}
                <div className="mt-2.5 flex gap-2">
                  <button type="button" onClick={() => setEditando(false)} disabled={salvandoNome} className="btn btn-line !min-h-[42px] flex-1">Cancelar</button>
                  <button type="button" onClick={salvarNome} disabled={salvandoNome || novoNome.trim() === atual.a.identificador_paciente || novoNome.trim().length < 2} className="btn btn-gold !min-h-[42px] flex-1">{salvandoNome ? 'Salvando…' : 'Salvar'}</button>
                </div>
              </div>
            ) : (
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <p className="break-words text-[1.05rem] font-semibold">{atual.a.identificador_paciente}</p>
                <button type="button" onClick={() => { setNovoNome(atual.a.identificador_paciente); setEditando(true); setErroNome(''); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[0.78rem] font-semibold text-gold-700 transition hover:bg-ivory"><Pencil size={14} />Editar</button>
              </div>
            )}
          </div>

          <dl className="mt-3 divide-y divide-line">
            {([
              ['Enviada em', fmtData(atual.f.created_at)],
              ['Cidade', atual.a.cidade],
              ['Dispositivo', atual.f.dispositivo ? `${atual.f.dispositivo} · ${atual.f.so} · ${atual.f.navegador}` : 'Não registrado'],
              ['Tamanho', tam(atual.f.bytes)],
              ...(atual.f.tipo === 'video' ? [['Duração', fmtDur(atual.f.duracao) || '-'] as [string, string]] : []),
              ['Dimensões', atual.f.width && atual.f.height ? `${atual.f.width} × ${atual.f.height} px` : '-'],
              [atual.f.tipo === 'video' ? 'Vídeo' : 'Foto', `${atual.a.fotos.findIndex((x) => x.id === atual.f.id) + 1} de ${atual.a.fotos.length} deste atendimento`],
            ] as const).map(([k, v]) => <div key={k} className="py-2"><dt className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-ink/50">{k}</dt><dd className="mt-0.5 break-words text-[0.88rem] font-medium">{v}</dd></div>)}
          </dl>

          <div className="mt-auto flex gap-2.5 pt-4">
            <a href={`${fotoUrl(atual.f.id)}?download=1`} className="btn btn-line !min-h-[46px] flex-1 !gap-2"><Download size={17} />Baixar</a>
            <button type="button" onClick={() => setApagar(atual.f.id)} className="btn !min-h-[46px] flex-1 !gap-2 border border-[#b3261e]/40 bg-white text-[#b3261e] hover:bg-[#fdf0ee]"><Trash2 size={17} />Excluir</button>
          </div>
          <p className="mt-2.5 text-[0.7rem] leading-snug text-ink/50">Excluir remove a foto só para você. A administração mantém o registro.</p>
        </div>
      </div>
    </div>
  );

  /** Menu do "Novo envio": câmera ou arquivos do aparelho. */
  const menuNovoUI = menuNovo && (
    <>
      <div className="fade-in fixed inset-0 z-[65] bg-black/45" onClick={() => { if (Date.now() - aberturaMenu.current > 400) setMenuNovo(false); }} aria-hidden />
      <div role="menu" aria-label="Novo envio" className="pop fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-[66] mx-auto max-w-[380px] overflow-hidden rounded-2xl bg-white p-2 shadow-[0_24px_60px_-20px_rgba(33,24,13,.6)] lg:inset-x-auto lg:bottom-auto lg:left-1/2 lg:top-[7.5rem] lg:-translate-x-1/2">
        <p className="px-3 pb-1 pt-2 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-ink/45">Novo envio</p>
        <button type="button" role="menuitem" onClick={() => { setMenuNovo(false); if (typeof navigator.mediaDevices?.getUserMedia === 'function') { setCamModo('foto'); setCamAberta(true); } else camera.current?.click(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left transition hover:bg-ivory active:scale-[0.99]">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white" style={{ background: 'linear-gradient(180deg,#c9a24a,#a67c26)' }}><Camera size={22} strokeWidth={1.6} /></span>
          <span className="leading-tight"><b className="block text-[0.95rem]">Tirar foto</b><span className="text-[0.78rem] text-ink/55">Abrir a câmera</span></span>
        </button>
        <button type="button" role="menuitem" onClick={() => { setMenuNovo(false); if (typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof MediaRecorder !== 'undefined') { setCamModo('video'); setCamAberta(true); } else cameraVideo.current?.click(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left transition hover:bg-ivory active:scale-[0.99]">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white" style={{ background: 'linear-gradient(180deg,#c9a24a,#a67c26)' }}><Video size={22} strokeWidth={1.6} /></span>
          <span className="leading-tight"><b className="block text-[0.95rem]">Gravar vídeo</b><span className="text-[0.78rem] text-ink/55">Gravar com a câmera do aparelho</span></span>
        </button>
        <button type="button" role="menuitem" onClick={() => { setMenuNovo(false); galeria.current?.click(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left transition hover:bg-ivory active:scale-[0.99]">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f6efe0] text-gold-600"><ImageIcon size={22} strokeWidth={1.6} /></span>
          <span className="leading-tight"><b className="block text-[0.95rem]">Enviar do dispositivo</b><span className="text-[0.78rem] text-ink/55">Escolher fotos ou vídeos da galeria</span></span>
        </button>
      </div>
    </>
  );

  /** Folha de confirmação: aparece quando há fotos escolhidas; pede o paciente e envia. */
  const folhaEnvio = itens.length > 0 && (
    <div role="dialog" aria-modal="true" aria-label="Enviar fotos" className="fade-in fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-6" onClick={() => !enviando && cancelarEnvio()}>
      <div className="pop w-full max-w-[460px] rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[1.35rem] font-bold leading-none">Enviar <span className="italic text-gold-600">{itens.some((i) => i.video) ? 'arquivos' : 'fotos'}</span></h2>
          <span className="text-[0.72rem] font-semibold text-ink/45">{itens.length}/{MAX}</span>
        </div>
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {itens.map((i, k) => (
            <li key={i.url} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-sand ring-1 ring-line">
              {i.video && !i.thumb
                ? <span className="grid h-full w-full place-items-center text-gold-600"><Play size={20} /></span>
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={i.thumb ?? i.url} alt={`Pré-visualização ${k + 1}`} className="h-full w-full object-cover" />}
              {i.video && <span className="absolute bottom-0.5 left-0.5 inline-flex items-center gap-0.5 rounded bg-black/65 px-1 py-px text-[0.6rem] font-semibold text-white"><Play size={8} fill="currentColor" />{fmtDur(i.dur)}</span>}
              <button type="button" disabled={enviando} onClick={() => remover(k)} aria-label="Remover foto" className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-ink/75 text-[0.8rem] leading-none text-white">×</button>
            </li>
          ))}
          {itens.length < MAX && <li className="shrink-0"><button type="button" disabled={enviando} onClick={() => abrirMenuNovo()} aria-label="Adicionar mais fotos ou vídeos" className="grid h-16 w-16 place-items-center rounded-xl border border-dashed border-gold-500/60 text-gold-600 transition hover:bg-ivory"><PlusCircle size={22} strokeWidth={1.6} /></button></li>}
        </ul>
        <div className="relative mt-3">
          <User size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/50" aria-hidden />
          <input ref={identRef} autoFocus aria-label="Identificador do paciente" value={ident} onChange={(e) => setIdent(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && pronto) enviar(); }} maxLength={80} placeholder="Paciente (ex.: P-4587)" className="field !mt-0" />
        </div>
        {msg && !msg.ok && <p role="alert" className="mt-2.5 rounded-xl bg-[#fdf0ee] px-3 py-2 text-[0.8rem] font-medium text-[#b3261e]">{msg.texto}</p>}
        <div className="mt-3 flex gap-2.5">
          <button type="button" disabled={enviando} onClick={cancelarEnvio} className="btn btn-line !min-h-[48px] shrink-0 !px-5">Cancelar</button>
          <button type="button" onClick={enviar} disabled={!pronto} className="btn btn-gold !min-h-[48px] flex-1">
            {enviando ? 'Enviando…' : `Enviar ${itens.length} ${itens.some((i) => i.video) ? 'arquivo' : 'foto'}${itens.length === 1 ? '' : 's'}`}
          </button>
        </div>
        <p className="mt-2.5 flex items-center gap-1.5 text-[0.7rem] text-ink/50"><Info size={13} className="shrink-0" />As fotos são organizadas e centralizadas pelo Instituto Sharon.</p>
      </div>
    </div>
  );


  useImperativeHandle(ref, () => ({ abrirMenu: abrirMenuNovo }));
  useEffect(() => { onTotal?.(meus.length); }, [meus.length, onTotal]);

  return (
    <>
      {!semLista && painelEnvios}
      <input ref={galeria} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { adicionar(e.target.files); e.target.value = ''; }} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { adicionar(e.target.files); e.target.value = ''; }} />
      <input ref={cameraVideo} type="file" accept="video/*" capture="environment" hidden onChange={(e) => { adicionar(e.target.files); e.target.value = ''; }} />
      {modalDetalhe}
      {menuNovoUI}
      {folhaEnvio}
      {camAberta && <CameraCaptura modo={camModo} total={itens.length} max={MAX} onFoto={(f) => adicionar([f])} onVideo={(f) => adicionar([f])} onFechar={() => setCamAberta(false)} onNativo={() => { setCamAberta(false); (camModo === 'video' ? cameraVideo : camera).current?.click(); }} />}
      {apagar !== null && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Excluir foto" className="pop fixed inset-0 z-[140] grid place-items-center bg-[#120d06]/70 p-5 backdrop-blur-sm" onClick={() => !apagando && setApagar(null)}>
          <div className="w-full max-w-[340px] rounded-2xl bg-white p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,.7)]" onClick={(e) => e.stopPropagation()}>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#fdf0ee] text-[#b3261e]"><Trash2 size={20} /></span>
            <h3 className="mt-3 text-[1.15rem] font-bold">Excluir esta foto?</h3>
            <p className="mt-1 text-[0.85rem] leading-snug text-ink/65">Ela deixará de aparecer para você. A administração é avisada e pode recuperá-la.</p>
            <div className="mt-4 flex gap-2">
              <button type="button" disabled={apagando} onClick={() => setApagar(null)} className="btn btn-line flex-1 !min-h-[44px]">Cancelar</button>
              <button type="button" disabled={apagando} onClick={async () => { setApagando(true); try { await api(`/atendimentos/fotos/${apagar}`, { method: 'DELETE' }); setVer(null); setDet(null); await carregar(); } catch { /* mantém a foto */ } setApagando(false); setApagar(null); }} className="flex-1 rounded-xl bg-[#b3261e] px-4 text-[0.95rem] font-semibold text-white transition hover:brightness-110 disabled:opacity-60" style={{ minHeight: 44 }}>{apagando ? 'Excluindo…' : 'Excluir'}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {ver && createPortal(<Ampliada video={ver.a.fotos[ver.i].tipo === 'video'} src={fotoUrl(ver.a.fotos[ver.i].id)} baixar={`${fotoUrl(ver.a.fotos[ver.i].id)}?download=1`} excluir={() => setApagar(ver.a.fotos[ver.i].id)} onFechar={() => setVer(null)} nav={{ atual: ver.i, total: ver.a.fotos.length, ir: (n) => setVer({ a: ver.a, i: n }) }} />, document.body)}
    </>
  );
});

export default MeusEnvios;
