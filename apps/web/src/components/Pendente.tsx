'use client';
import { useEffect, useState } from 'react';
import { Clock, LogOut, RefreshCw } from 'lucide-react';
import { api, Me } from '@/lib/api';
import { Wordmark } from './Brand';
import Spinner from './Spinner';

/** Tela do aluno que entrou (ex.: com Google) mas ainda não foi liberado pela administração. Verifica sozinha a cada 10 s. */
export default function Pendente({ me, sair }: { me: Me; sair: () => void }) {
  const [checando, setChecando] = useState(false);

  async function verificar() {
    setChecando(true);
    try {
      const u = await api<Me>('/auth/me');
      if (u.autorizado) window.location.reload();
    } catch { /* mantém a tela */ }
    setChecando(false);
  }

  useEffect(() => {
    const t = setInterval(() => { api<Me>('/auth/me').then((u) => u.autorizado && window.location.reload()).catch(() => null); }, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center bg-gradient-to-b from-white to-[#f7f3ea] px-6 py-10">
      <section className="w-full max-w-[420px] text-center">
        <div className="flex justify-center"><Wordmark stacked /></div>
        <div className="card mt-8 p-7">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#fdf1da] text-[#9a6a0a]"><Clock size={26} /></span>
          <h1 className="mt-4 text-[1.9rem] font-bold">Aguardando autorização</h1>
          <p className="mt-2 text-[0.92rem] text-ink/70">
            Olá, <strong>{me.nome}</strong>. Seu acesso foi registrado e está aguardando a liberação da administração do Instituto. Assim que for aprovado, você poderá enviar as fotos dos atendimentos.
          </p>
          <p className="mt-3 text-[0.8rem] text-ink/50">Conectado como {me.email}</p>
          <button type="button" onClick={verificar} disabled={checando} className="btn btn-gold mt-6 w-full">
            {checando ? <><Spinner />Aguarde...</> : <><RefreshCw size={18} />Verificar novamente</>}
          </button>
          <button type="button" onClick={sair} className="btn btn-line mt-3 w-full"><LogOut size={18} />Sair</button>
        </div>
      </section>
    </main>
  );
}
