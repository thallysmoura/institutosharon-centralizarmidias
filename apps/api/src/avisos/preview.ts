import { lookup } from 'node:dns/promises';
import { isIPv4 } from 'node:net';
import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

const MAX_HTML = 400 * 1024;
const MAX_IMG = 3 * 1024 * 1024;

function privado(ip: string) {
  if (isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const l = ip.toLowerCase();
  return l === '::1' || l === '::' || /^(fc|fd|fe[89ab])/.test(l) || l.startsWith('::ffff:');
}

/** Baixa uma URL pública com limites de tempo/tamanho e sem alcançar a rede interna (confere DNS a cada redirecionamento). */
async function baixar(url: string, max: number, accept: string) {
  let u: URL;
  try { u = new URL(url); } catch { throw new BadRequestException('Link inválido.'); }
  for (let i = 0; i < 4; i++) {
    if (!/^https?:$/.test(u.protocol) || u.username || u.password || (u.port && u.port !== '80' && u.port !== '443')) throw new BadRequestException('Link inválido.');
    const ips = await lookup(u.hostname, { all: true }).catch(() => []);
    if (!ips.length || ips.some((x) => privado(x.address))) throw new BadRequestException('Não foi possível acessar este link.');
    const r = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(5000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; InstitutoSharonBot/1.0)', accept, 'accept-language': 'pt-BR,pt;q=0.9,en;q=0.5' } }).catch(() => null);
    if (!r) throw new BadRequestException('Não foi possível acessar este link.');
    const loc = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && loc) { try { u = new URL(loc, u); } catch { throw new BadRequestException('Link inválido.'); } continue; }
    if (!r.ok || !r.body) throw new BadRequestException('Não foi possível abrir este link.');
    const partes: Buffer[] = [];
    let total = 0;
    const leitor = r.body.getReader();
    try {
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        total += value.length;
        partes.push(Buffer.from(value));
        if (total >= max) break; // para no limite: o que importa (head do HTML) já veio
      }
    } finally { void leitor.cancel().catch(() => undefined); }
    return { buf: Buffer.concat(partes).subarray(0, max), tipo: r.headers.get('content-type') ?? '', url: u };
  }
  throw new BadRequestException('Redirecionamentos demais neste link.');
}

const entidades = (t: string) => t.replace(/&(amp|quot|lt|gt|#39|apos|nbsp);/g, (_, e: string) => ({ amp: '&', quot: '"', lt: '<', gt: '>', '#39': "'", apos: "'", nbsp: ' ' }[e] ?? ''));
function meta(html: string, ...nomes: string[]) {
  for (const n of nomes) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*>`, 'i');
    const tag = re.exec(html)?.[0];
    const v = tag && /content=["']([^"']*)["']/i.exec(tag)?.[1];
    if (v) return entidades(v).replace(/\s+/g, ' ').trim();
  }
  return null;
}

export type PreviaLink = { url: string; titulo: string; descricao: string | null; site: string; imagem: { buf: Buffer; mime: string } | null };

/** Título, descrição, site e imagem de capa (reduzida) de um link, para o cartão de prévia do aviso. */
export async function previaDeLink(url: string): Promise<PreviaLink> {
  const pag = await baixar(url, MAX_HTML, 'text/html,application/xhtml+xml');
  if (!/html|xml/i.test(pag.tipo)) {
    const nome = decodeURIComponent(pag.url.pathname.split('/').pop() || pag.url.hostname);
    return { url: pag.url.toString(), titulo: nome.slice(0, 200), descricao: null, site: pag.url.hostname.replace(/^www\./, ''), imagem: null };
  }
  const html = pag.buf.toString('utf8');
  const titulo = meta(html, 'og:title', 'twitter:title') ?? entidades(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '').replace(/\s+/g, ' ').trim();
  const descricao = meta(html, 'og:description', 'twitter:description', 'description');
  const site = meta(html, 'og:site_name') ?? pag.url.hostname.replace(/^www\./, '');
  let imagem: PreviaLink['imagem'] = null;
  const img = meta(html, 'og:image', 'og:image:url', 'twitter:image');
  if (img) {
    try {
      const alvo = new URL(img, pag.url).toString();
      const f = await baixar(alvo, MAX_IMG, 'image/*');
      const buf = await sharp(f.buf, { failOn: 'none' }).rotate().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
      imagem = { buf, mime: 'image/webp' };
    } catch { imagem = null; }
  }
  return { url: pag.url.toString(), titulo: (titulo || pag.url.hostname).slice(0, 200), descricao: descricao ? descricao.slice(0, 400) : null, site: site.slice(0, 80), imagem };
}
