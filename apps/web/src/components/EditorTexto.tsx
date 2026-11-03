'use client';
import { useEffect, useRef } from 'react';
import { Bold, Eraser, Heading3, Italic, Link2, List, ListOrdered, Underline } from 'lucide-react';

const FERRAMENTAS = [
  { cmd: 'bold', rotulo: 'Negrito (Ctrl+B)', Icone: Bold },
  { cmd: 'italic', rotulo: 'Itálico (Ctrl+I)', Icone: Italic },
  { cmd: 'underline', rotulo: 'Sublinhado (Ctrl+U)', Icone: Underline },
  { cmd: 'titulo', rotulo: 'Título', Icone: Heading3 },
  { cmd: 'insertUnorderedList', rotulo: 'Lista com marcadores', Icone: List },
  { cmd: 'insertOrderedList', rotulo: 'Lista numerada', Icone: ListOrdered },
  { cmd: 'link', rotulo: 'Inserir link', Icone: Link2 },
  { cmd: 'removeFormat', rotulo: 'Limpar formatação', Icone: Eraser },
] as const;

/** Editor de texto formatado simples (negrito, itálico, sublinhado, título, listas, link). Devolve HTML; o servidor sanitiza. */
export default function EditorTexto({ valor, onChange, placeholder = 'Escreva o aviso...' }: { valor: string; onChange: (html: string) => void; placeholder?: string }) {
  const area = useRef<HTMLDivElement>(null);

  // Conteúdo inicial (a edição de outro aviso remonta o componente por `key`).
  useEffect(() => { if (area.current) area.current.innerHTML = valor; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const emitir = () => onChange(area.current?.innerHTML ?? '');

  function aplicar(cmd: string) {
    area.current?.focus();
    if (cmd === 'titulo') {
      const atual = document.queryCommandValue('formatBlock').toLowerCase();
      document.execCommand('formatBlock', false, atual === 'h3' ? 'p' : 'h3');
    } else if (cmd === 'link') {
      const url = window.prompt('Endereço do link (https://...)');
      if (url && /^(https?:\/\/|mailto:)/i.test(url.trim())) document.execCommand('createLink', false, url.trim());
    } else document.execCommand(cmd);
    emitir();
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white transition focus-within:border-gold-500 focus-within:ring-4 focus-within:ring-gold-500/15">
      <div role="toolbar" aria-label="Formatação do texto" className="flex flex-wrap gap-0.5 border-b border-line bg-[#fbf8f1] p-1.5">
        {FERRAMENTAS.map(({ cmd, rotulo, Icone }) => (
          <button key={cmd} type="button" title={rotulo} aria-label={rotulo} onMouseDown={(e) => e.preventDefault()} onClick={() => aplicar(cmd)}
            className="grid h-9 w-9 place-items-center rounded-lg text-ink/70 transition hover:bg-white hover:text-gold-700"><Icone size={17} strokeWidth={1.8} /></button>
        ))}
      </div>
      <div
        ref={area}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Texto do aviso"
        data-placeholder={placeholder}
        onInput={emitir}
        onBlur={emitir}
        onPaste={(e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); }}
        className="editor-vazio aviso-html min-h-[160px] max-h-[40dvh] overflow-y-auto px-3.5 py-3 text-[0.92rem] leading-relaxed outline-none"
      />
    </div>
  );
}
