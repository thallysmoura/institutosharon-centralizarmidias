/** Vídeos no envio: limites, detecção e dados de prévia (quadro inicial + duração) gerados no aparelho. */
export const TIPOS_VIDEO = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
export const MAX_VIDEOS = 3;
export const MAX_FOTO_BYTES = 25 * 1024 * 1024; // fotos de iPhone em alta resolução passam de 10 MB
export const MAX_VIDEO_BYTES = 90 * 1024 * 1024; // por vídeo
export const MAX_ENVIO_BYTES = 95 * 1024 * 1024; // soma de tudo num envio: a hospedagem recusa corpo acima de 100 MB
export const MAX_GRAVACAO_S = 15; // duração máxima de cada vídeo (gravado ou escolhido da galeria)

export type MetaVideo = { poster: Blob | null; duracao: number };
const metas = new WeakMap<File, MetaVideo>();
export const metaDe = (f: File) => metas.get(f);
export const definirMeta = (f: File, m: MetaVideo) => metas.set(f, m);

export const fmtMB = (b: number) => `${(b / 1048576).toFixed(b >= 10 * 1048576 ? 0 : 1).replace('.', ',')} MB`;
export const ehVideo = (f: File) => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(f.name);
export const fmtDur = (s?: number | null) => {
  if (!s || !Number.isFinite(s)) return '';
  const t = Math.round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/** Lê a duração e captura um quadro do vídeo como prévia (JPEG). Nunca falha: sem prévia, o envio segue sem miniatura. */
export function prepararVideo(file: File): Promise<MetaVideo> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    let feito = false;
    const fim = (m: MetaVideo) => { if (feito) return; feito = true; URL.revokeObjectURL(url); v.removeAttribute('src'); v.load(); definirMeta(file, m); resolve(m); };
    const limite = setTimeout(() => fim({ poster: null, duracao: Number.isFinite(v.duration) ? v.duration : 0 }), 8000);
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    v.onerror = () => { clearTimeout(limite); fim({ poster: null, duracao: 0 }); };
    v.onloadedmetadata = () => { v.currentTime = Math.min(0.3, Math.max(0, (v.duration || 1) / 4)); };
    v.onseeked = () => {
      clearTimeout(limite);
      try {
        const c = document.createElement('canvas');
        const w = v.videoWidth || 640;
        const h = v.videoHeight || 360;
        const esc = Math.min(1, 1280 / Math.max(w, h));
        c.width = Math.round(w * esc);
        c.height = Math.round(h * esc);
        c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
        c.toBlob((b) => fim({ poster: b, duracao: v.duration || 0 }), 'image/jpeg', 0.85);
      } catch { fim({ poster: null, duracao: v.duration || 0 }); }
    };
    v.src = url;
  });
}
