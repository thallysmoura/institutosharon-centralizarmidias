'use client';

/** Último recurso: falha no layout raiz. Sem dependências de estilo do app, para sempre conseguir renderizar. */
export default function ErroGlobal({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#FAF7F0', color: '#21180D', fontFamily: 'system-ui, sans-serif', padding: 20 }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, margin: '0 0 8px' }}>Algo não saiu como esperado</h1>
          <p style={{ margin: '0 0 22px', color: '#5b4f3d', lineHeight: 1.5 }}>Não foi possível carregar o sistema agora. Tente novamente em instantes.</p>
          <button type="button" onClick={reset} style={{ background: '#a67c26', color: '#fff', border: 0, borderRadius: 12, padding: '13px 26px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Tentar novamente</button>
        </div>
      </body>
    </html>
  );
}
