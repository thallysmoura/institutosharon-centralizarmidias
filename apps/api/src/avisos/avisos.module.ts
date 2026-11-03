import { Body, Controller, Delete, Get, HttpCode, Injectable, Logger, Module, NotFoundException, OnModuleInit, Param, ParseIntPipe, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { ConfigService } from '@nestjs/config';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { Request, Response } from 'express';
import sanitizeHtml from 'sanitize-html';
import webpush from 'web-push';
import { DbService } from '../db/db.service';
import { AuditoriaService } from '../db/auditoria.service';
import { AuthGuard, Me, Roles, SessionUser } from '../common/auth';
import { StorageService } from '../storage/storage.service';
import { previaDeLink } from './preview';

class AnexoDto {
  @IsOptional() @IsInt() id?: number; // anexo já salvo (edição)
  @IsIn(['arquivo', 'link']) tipo!: 'arquivo' | 'link';
  @IsOptional() @IsString() @MaxLength(120) nome?: string;
  @IsOptional() @IsString() @MaxLength(80) mime?: string;
  @IsOptional() @IsInt() tamanho?: number;
  @IsOptional() @IsString() @MaxLength(200) chave?: string;
  @IsOptional() @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) @MaxLength(1000) url?: string;
  @IsOptional() @IsString() @MaxLength(220) titulo?: string;
  @IsOptional() @IsString() @MaxLength(420) descricao?: string;
  @IsOptional() @IsString() @MaxLength(90) site?: string;
}
class AvisoDto {
  @IsString() @MinLength(2) @MaxLength(120) titulo!: string;
  @IsString() @MinLength(1) @MaxLength(12000) corpo!: string;
  @IsIn(['todos', 'cidades', 'pessoas']) alvo!: 'todos' | 'cidades' | 'pessoas';
  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsInt({ each: true }) destinatarios?: number[];
  @IsOptional() @IsArray() @ArrayMaxSize(60) @IsInt({ each: true }) cidades?: number[];
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => AnexoDto) anexos?: AnexoDto[];
}
class PreviaDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) @MaxLength(1000) url!: string;
}

const CHAVE_OK = /^avisos\/[0-9a-f-]{36}\.(pdf|webp)$/;
const MAX_ANEXO = 10 * 1024 * 1024;
const FOTO = (a: string) => `CASE WHEN ${a}.foto_key IS NOT NULL OR ${a}.foto_url IS NOT NULL THEN '/users/' || ${a}.id || '/foto?v=' || ${a}.foto_v END`;
/** Anexos do aviso `a` como JSON (sem expor a chave do armazenamento). */
const ANEXOS = `COALESCE((SELECT json_agg(json_build_object('id', t.id, 'tipo', t.tipo, 'nome', t.nome, 'mime', t.mime, 'tamanho', t.tamanho, 'url', t.url, 'titulo', t.titulo, 'descricao', t.descricao, 'site', t.site, 'imagem', (t.tipo = 'link' AND t.chave IS NOT NULL)) ORDER BY t.ordem, t.id) FROM sistema.aviso_anexos t WHERE t.aviso_id = a.id), '[]')`;
class ChavesDto {
  @IsString() @MaxLength(200) p256dh!: string;
  @IsString() @MaxLength(100) auth!: string;
}
class PushDto {
  @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(700) endpoint!: string;
  @ValidateNested() @Type(() => ChavesDto) keys!: ChavesDto;
}

/** Avisos (mural do administrador) e notificações dos usuários, com envio Web Push. */
@Injectable()
export class AvisosService implements OnModuleInit {
  private readonly log = new Logger('Avisos');
  private push = false;
  constructor(private readonly db: DbService, private readonly cfg: ConfigService) {}

  onModuleInit() {
    const pub = this.cfg.get<string>('VAPID_PUBLIC_KEY');
    const prv = this.cfg.get<string>('VAPID_PRIVATE_KEY');
    if (pub && prv) {
      webpush.setVapidDetails(this.cfg.get<string>('VAPID_SUBJECT', 'https://institutosharonfotos.mouora.com'), pub, prv);
      this.push = true;
    } else this.log.warn('VAPID_* ausentes: notificações push desativadas (o painel in-app continua).');
  }

  chavePublica() { return this.cfg.get<string>('VAPID_PUBLIC_KEY') ?? null; }

  /** Só formatação básica: nada de scripts, estilos ou atributos soltos. */
  limpar(html: string) {
    return sanitizeHtml(html, {
      allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'h3', 'blockquote'],
      allowedAttributes: { a: ['href', 'target', 'rel'] },
      allowedSchemes: ['http', 'https', 'mailto'],
      transformTags: { a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }), b: 'strong', i: 'em' },
    }).trim();
  }
  texto(html: string) { return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim(); }

  /** Dispara o push para os destinatários, sem bloquear a resposta e removendo inscrições expiradas. */
  async enviarPush(avisoId: number, titulo: string, corpoHtml: string, destinos: number[] | null) {
    if (!this.push) return;
    const subs = (await this.db.query(destinos ? 'SELECT id, endpoint, p256dh, auth FROM sistema.push_subs WHERE user_id = ANY($1::int[])' : 'SELECT id, endpoint, p256dh, auth FROM sistema.push_subs', destinos ? [destinos] : [])).rows;
    const carga = JSON.stringify({ title: titulo, body: this.texto(corpoHtml).slice(0, 160), url: '/', tag: `aviso-${avisoId}` });
    await Promise.all(subs.map(async (s) => {
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga, { TTL: 86400 }); }
      catch (e) {
        const c = (e as { statusCode?: number }).statusCode;
        if (c === 404 || c === 410) await this.db.query('DELETE FROM sistema.push_subs WHERE id=$1', [s.id]);
      }
    }));
  }
}

const VISIVEL = `(a.para_todos OR EXISTS (SELECT 1 FROM sistema.aviso_destinos d WHERE d.aviso_id=a.id AND d.user_id=$1)
  OR (a.para_cidades IS NOT NULL AND EXISTS (SELECT 1 FROM sistema.users me WHERE me.id=$1 AND me.cidade_id = ANY(a.para_cidades))))`;
/** Quem é público do aviso `a` entre os usuários `u`. */
const AUDIENCIA = `(a.para_todos OR EXISTS (SELECT 1 FROM sistema.aviso_destinos d WHERE d.aviso_id=a.id AND d.user_id=u.id)
  OR (a.para_cidades IS NOT NULL AND u.cidade_id = ANY(a.para_cidades)))`;
const BASE = `FROM sistema.avisos a JOIN sistema.users u ON ${AUDIENCIA}
  LEFT JOIN sistema.cidades c ON c.id=u.cidade_id
  LEFT JOIN sistema.aviso_leituras l ON l.aviso_id=a.id AND l.user_id=u.id
 WHERE a.id=$1`;

/** Notificações do próprio usuário. */
@Controller('notificacoes')
@UseGuards(AuthGuard)
export class NotificacoesController {
  constructor(private readonly db: DbService, private readonly svc: AvisosService, private readonly storage: StorageService) {}

  @Get()
  async listar(@Me() u: SessionUser) {
    const itens = (await this.db.query(
      `SELECT a.id, a.titulo, a.corpo, a.created_at, a.editado_em, x.nome AS autor, ${FOTO('x')} AS autor_foto, (l.user_id IS NOT NULL) AS lida, ${ANEXOS} AS anexos
         FROM sistema.avisos a LEFT JOIN sistema.users x ON x.id=a.criado_por
         LEFT JOIN sistema.aviso_leituras l ON l.aviso_id=a.id AND l.user_id=$1
        WHERE ${VISIVEL} ORDER BY a.created_at DESC LIMIT 60`, [u.id])).rows;
    const nao = (await this.db.query(
      `SELECT count(*)::int AS n FROM sistema.avisos a WHERE ${VISIVEL} AND NOT EXISTS (SELECT 1 FROM sistema.aviso_leituras l WHERE l.aviso_id=a.id AND l.user_id=$1)`, [u.id])).rows[0].n;
    return { itens, nao_lidas: nao };
  }

  @Post('lidas')
  @HttpCode(200)
  async todasLidas(@Me() u: SessionUser) {
    await this.db.query(`INSERT INTO sistema.aviso_leituras (aviso_id, user_id) SELECT a.id, $1 FROM sistema.avisos a WHERE ${VISIVEL} ON CONFLICT DO NOTHING`, [u.id]);
    return { ok: true };
  }

  @Post(':id/lida')
  @HttpCode(200)
  async lida(@Me() u: SessionUser, @Param('id', ParseIntPipe) id: number) {
    await this.db.query(`INSERT INTO sistema.aviso_leituras (aviso_id, user_id) SELECT a.id, $1 FROM sistema.avisos a WHERE a.id=$2 AND ${VISIVEL} ON CONFLICT DO NOTHING`, [u.id, id]);
    return { ok: true };
  }

  /** Arquivo anexado (PDF/imagem) ou capa da prévia de um link; só para quem recebe o aviso (ou administrador). `?baixar=1` força o download. */
  @Get('anexos/:id')
  async anexo(@Me() u: SessionUser, @Param('id', ParseIntPipe) id: number, @Query('baixar') baixar: string | undefined, @Res() res: Response) {
    const t = (await this.db.query(
      `SELECT t.chave, t.nome, t.mime FROM sistema.aviso_anexos t JOIN sistema.avisos a ON a.id=t.aviso_id WHERE t.id=$2 AND t.chave IS NOT NULL AND ($3::boolean OR ${VISIVEL})`,
      [u.id, id, u.role === 'ADMIN'])).rows[0];
    if (!t) throw new NotFoundException();
    res.set({ 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' });
    const nome = baixar ? String(t.nome ?? 'arquivo').replace(/["\r\n\\]/g, '') : undefined;
    const url = await this.storage.urlAssinada(t.chave, nome);
    if (url) return res.redirect(302, url);
    res.set({ 'Content-Type': t.mime ?? 'application/octet-stream', ...(nome ? { 'Content-Disposition': `attachment; filename="${nome}"` } : {}) });
    return res.send(await this.storage.get(t.chave));
  }

  @Get('vapid')
  vapid() { return { publica: this.svc.chavePublica() }; }

  /** Guarda (ou atualiza) a inscrição de push deste aparelho. */
  @Post('push')
  @HttpCode(200)
  async inscrever(@Me() u: SessionUser, @Body() dto: PushDto, @Req() req: Request) {
    const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 300) : null;
    await this.db.query(
      `INSERT INTO sistema.push_subs (user_id, endpoint, p256dh, auth, ua) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (endpoint) DO UPDATE SET user_id=EXCLUDED.user_id, p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth, ua=EXCLUDED.ua`,
      [u.id, dto.endpoint, dto.keys.p256dh, dto.keys.auth, ua],
    );
    return { ok: true };
  }
}

function tipoArquivo(b: Buffer): 'pdf' | 'imagem' | null {
  if (b.length < 12) return null;
  if (b.toString('ascii', 0, 5) === '%PDF-') return 'pdf';
  if ((b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) || (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) || (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP')) return 'imagem';
  return null;
}

/** Mural de avisos (histórico, alcance, criar, editar, excluir), anexos e busca de destinatários. */
@Controller('admin')
@UseGuards(AuthGuard)
@Roles('ADMIN')
export class AvisosAdminController {
  constructor(private readonly db: DbService, private readonly svc: AvisosService, private readonly aud: AuditoriaService, private readonly storage: StorageService) {}

  @Get('avisos')
  async historico() {
    return (await this.db.query(
      `SELECT a.id, a.titulo, a.corpo, a.para_todos, a.para_cidades, a.created_at, a.editado_em, x.nome AS autor, ${FOTO('x')} AS autor_foto,
              (SELECT count(*)::int FROM sistema.aviso_leituras l WHERE l.aviso_id=a.id) AS lidos,
              CASE WHEN a.para_todos THEN (SELECT count(*)::int FROM sistema.users)
                   WHEN a.para_cidades IS NOT NULL THEN (SELECT count(*)::int FROM sistema.users u WHERE u.cidade_id = ANY(a.para_cidades))
                   ELSE (SELECT count(*)::int FROM sistema.aviso_destinos d WHERE d.aviso_id=a.id) END AS total,
              COALESCE((SELECT json_agg(r) FROM (SELECT u.id, u.nome, ${FOTO('u')} AS foto FROM sistema.aviso_leituras l JOIN sistema.users u ON u.id=l.user_id WHERE l.aviso_id=a.id ORDER BY l.lido_em DESC LIMIT 6) r), '[]') AS leitores,
              COALESCE((SELECT json_agg(json_build_object('id', u.id, 'nome', u.nome, 'email', u.email) ORDER BY u.nome) FROM sistema.aviso_destinos d JOIN sistema.users u ON u.id=d.user_id WHERE d.aviso_id=a.id), '[]') AS destinatarios,
              COALESCE((SELECT json_agg(json_build_object('id', c.id, 'nome', c.nome) ORDER BY c.nome) FROM sistema.cidades c WHERE c.id = ANY(a.para_cidades)), '[]') AS cidades,
              ${ANEXOS} AS anexos
         FROM sistema.avisos a LEFT JOIN sistema.users x ON x.id=a.criado_por ORDER BY a.created_at DESC LIMIT 150`)).rows;
  }

  @Get('avisos/cidades')
  async cidades() {
    return (await this.db.query('SELECT c.id, c.nome, (SELECT count(*)::int FROM sistema.users u WHERE u.cidade_id=c.id) AS usuarios FROM sistema.cidades c ORDER BY c.nome')).rows;
  }

  /** Alcance do aviso: resumo, gráficos (por cidade, perfil e evolução das leituras) e lista paginada de quem recebeu, com busca e filtros. */
  @Get('avisos/:id/alcance')
  async alcance(@Param('id', ParseIntPipe) id: number, @Query('q') q = '', @Query('status') status = 'todos', @Query('cidade') cidade = '', @Query('pagina') pagina = '0') {
    const aviso = (await this.db.query('SELECT created_at FROM sistema.avisos WHERE id=$1', [id])).rows[0];
    if (!aviso) throw new NotFoundException();
    const t = q.trim().slice(0, 80);
    const like = t ? `%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : '';
    const pg = Math.max(0, Math.min(500, parseInt(pagina, 10) || 0));
    const st = ['lidos', 'pendentes'].includes(status) ? status : 'todos';
    const cid = /^\d+$/.test(cidade) ? Number(cidade) : null;
    const lista = this.db.query(
      `SELECT u.id, u.nome, u.email, u.role, u.matricula, c.nome AS cidade, ${FOTO('u')} AS foto, l.lido_em, count(*) OVER()::int AS total_filtrado ${BASE}
          AND ($2::text = '' OR u.nome ILIKE $2 OR u.email ILIKE $2 OR u.matricula ILIKE $2)
          AND ($3::text = 'todos' OR ($3::text = 'lidos' AND l.user_id IS NOT NULL) OR ($3::text = 'pendentes' AND l.user_id IS NULL))
          AND ($4::int IS NULL OR u.cidade_id = $4::int)
        ORDER BY l.lido_em DESC NULLS LAST, u.nome LIMIT 30 OFFSET $5`, [id, like, st, cid, pg * 30]);
    if (pg > 0) return { itens: (await lista).rows };
    const gran = Date.now() - new Date(aviso.created_at).getTime() < 3 * 864e5 ? 'hour' : 'day';
    const [itens, resumo, porCidade, serie] = await Promise.all([
      lista,
      this.db.query(
        `SELECT count(*)::int AS total, count(l.user_id)::int AS lidos,
                count(*) FILTER (WHERE u.role='ALUNO')::int AS alunos, count(l.user_id) FILTER (WHERE u.role='ALUNO')::int AS alunos_lidos,
                count(*) FILTER (WHERE u.role='ADMIN')::int AS admins, count(l.user_id) FILTER (WHERE u.role='ADMIN')::int AS admins_lidos,
                min(l.lido_em) AS primeira, max(l.lido_em) AS ultima ${BASE}`, [id]),
      this.db.query(`SELECT c.id, COALESCE(c.nome, 'Sem cidade') AS nome, count(*)::int AS total, count(l.user_id)::int AS lidos ${BASE} GROUP BY c.id, c.nome ORDER BY total DESC, nome LIMIT 30`, [id]),
      this.db.query(`SELECT date_trunc($2::text, l.lido_em) AS t, count(*)::int AS n ${BASE} AND l.user_id IS NOT NULL GROUP BY 1 ORDER BY 1`, [id, gran]),
    ]);
    return { resumo: resumo.rows[0], cidades: porCidade.rows, serie: { gran, pontos: serie.rows }, itens: itens.rows };
  }

  /** Busca qualquer usuário (aluno ou administrador) para escolher destinatários: 3+ caracteres, no máximo 20. */
  @Get('usuarios/busca')
  async buscar(@Query('q') q = '') {
    const t = q.trim();
    if (t.length < 3) return [];
    const like = `%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    return (await this.db.query('SELECT id, nome, email, role, matricula FROM sistema.users WHERE nome ILIKE $1 OR email ILIKE $1 OR matricula ILIKE $1 ORDER BY nome LIMIT 20', [like])).rows;
  }

  /** Envia um PDF ou imagem (até 10 MB) para anexar ao aviso; imagens são reduzidas e recomprimidas. */
  @Post('avisos/anexos')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('arquivo', { storage: memoryStorage(), limits: { fileSize: MAX_ANEXO, files: 1 } }))
  async enviarAnexo(@UploadedFile() f?: Express.Multer.File) {
    if (!f) throw new BadRequestException('Escolha um arquivo.');
    const tipo = tipoArquivo(f.buffer);
    if (!tipo) throw new BadRequestException('Formato não permitido. Use PDF, JPEG, PNG ou WebP.');
    const nome = (Buffer.from(f.originalname, 'latin1').toString('utf8').split(/[\\/]/).pop() ?? 'arquivo').replace(/[\u0000-\u001f"]/g, '').trim().slice(0, 110) || 'arquivo';
    const buf = tipo === 'pdf' ? f.buffer : await sharp(f.buffer, { failOn: 'none' }).rotate().resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
    const mime = tipo === 'pdf' ? 'application/pdf' : 'image/webp';
    const chave = `avisos/${randomUUID()}.${tipo === 'pdf' ? 'pdf' : 'webp'}`;
    await this.storage.put(chave, buf, mime);
    return { chave, nome: tipo === 'pdf' ? nome : nome.replace(/\.[^.]+$/, '') + '.webp', mime, tamanho: buf.length };
  }

  /** Prévia de um link (título, descrição, site e capa) para o cartão do aviso. */
  @Post('avisos/link-preview')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async previa(@Body() dto: PreviaDto) {
    const p = await previaDeLink(dto.url);
    let chave: string | null = null;
    if (p.imagem) { chave = `avisos/${randomUUID()}.webp`; await this.storage.put(chave, p.imagem.buf, p.imagem.mime); }
    return { url: p.url, titulo: p.titulo, descricao: p.descricao, site: p.site, chave, mime: p.imagem?.mime ?? null, imagem_data: p.imagem ? `data:${p.imagem.mime};base64,${p.imagem.buf.toString('base64')}` : null };
  }

  private async publico(dto: AvisoDto) {
    if (dto.alvo === 'todos') return { todos: true, cidades: null as number[] | null, pessoas: null as number[] | null, ids: null as number[] | null, texto: 'todos' };
    if (dto.alvo === 'cidades') {
      const cids = [...new Set(dto.cidades ?? [])];
      if (!cids.length) throw new BadRequestException('Escolha ao menos uma cidade.');
      const nomes = (await this.db.query('SELECT nome FROM sistema.cidades WHERE id = ANY($1::int[]) ORDER BY nome', [cids])).rows.map((r) => r.nome as string);
      if (nomes.length !== cids.length) throw new BadRequestException('Alguma cidade não existe mais.');
      const ids = (await this.db.query('SELECT id FROM sistema.users WHERE cidade_id = ANY($1::int[])', [cids])).rows.map((r) => r.id as number);
      return { todos: false, cidades: cids as number[] | null, pessoas: null as number[] | null, ids: ids as number[] | null, texto: `cidade(s): ${nomes.join(', ')}` };
    }
    const ids = [...new Set(dto.destinatarios ?? [])];
    if (!ids.length) throw new BadRequestException('Escolha ao menos uma pessoa.');
    const ok = (await this.db.query('SELECT id FROM sistema.users WHERE id = ANY($1::int[])', [ids])).rows.map((r) => r.id as number);
    if (ok.length !== ids.length) throw new BadRequestException('Algum destinatário não existe mais.');
    return { todos: false, cidades: null as number[] | null, pessoas: ids as number[] | null, ids: ids as number[] | null, texto: `${ids.length} pessoa(s)` };
  }
  private corpo(dto: AvisoDto) {
    const c = this.svc.limpar(dto.corpo);
    if (!this.svc.texto(c) && !dto.anexos?.length) throw new BadRequestException('Escreva o texto do aviso.');
    return c;
  }

  /** Confere os anexos antes de gravar qualquer coisa (o aviso não pode ficar pela metade). */
  private checarAnexos(lista: AnexoDto[] = []) {
    for (const a of lista) {
      if (a.id) continue;
      if ((a.chave && !CHAVE_OK.test(a.chave)) || (a.tipo === 'arquivo' && (!a.chave || !a.nome)) || (a.tipo === 'link' && !a.url)) throw new BadRequestException('Anexo inválido.');
    }
  }

  /** Grava os anexos novos e remove os que saíram do aviso (arquivos também saem do armazenamento). */
  private async anexos(avisoId: number, lista: AnexoDto[] = []) {
    const manter = lista.filter((a) => a.id).map((a) => a.id as number);
    const sairam = (await this.db.query('DELETE FROM sistema.aviso_anexos WHERE aviso_id=$1 AND id <> ALL($2::int[]) RETURNING chave', [avisoId, manter])).rows;
    for (const r of sairam) if (r.chave) await this.storage.remove(r.chave).catch(() => undefined);
    let ordem = 0;
    for (const a of lista) {
      ordem++;
      if (a.id) { await this.db.query('UPDATE sistema.aviso_anexos SET ordem=$3 WHERE id=$2 AND aviso_id=$1', [avisoId, a.id, ordem]); continue; }
      if (a.chave && !CHAVE_OK.test(a.chave)) throw new BadRequestException('Anexo inválido.');
      if (a.tipo === 'arquivo' && (!a.chave || !a.nome)) throw new BadRequestException('Anexo inválido.');
      if (a.tipo === 'link' && !a.url) throw new BadRequestException('Link inválido.');
      await this.db.query(
        'INSERT INTO sistema.aviso_anexos (aviso_id, tipo, ordem, nome, mime, tamanho, chave, url, titulo, descricao, site) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        [avisoId, a.tipo, ordem, a.nome ?? null, a.mime ?? null, a.tamanho ?? null, a.chave ?? null, a.tipo === 'link' ? a.url : null, a.titulo ?? null, a.descricao ?? null, a.site ?? null],
      );
    }
  }

  @Post('avisos')
  @HttpCode(201)
  async criar(@Me() u: SessionUser, @Body() dto: AvisoDto, @Req() req: Request) {
    const p = await this.publico(dto);
    const corpo = this.corpo(dto);
    this.checarAnexos(dto.anexos);
    const id = (await this.db.query('INSERT INTO sistema.avisos (titulo, corpo, para_todos, para_cidades, criado_por) VALUES ($1,$2,$3,$4,$5) RETURNING id', [dto.titulo.trim(), corpo, p.todos, p.cidades, u.id])).rows[0].id as number;
    if (p.pessoas) await this.db.query('INSERT INTO sistema.aviso_destinos (aviso_id, user_id) SELECT $1, unnest($2::int[])', [id, p.pessoas]);
    await this.anexos(id, dto.anexos);
    await this.aud.registrar('admin_criou_aviso', { ator: u.id, req, detalhe: { aviso: id, titulo: dto.titulo.trim(), para: p.texto, anexos: dto.anexos?.length ?? 0 } });
    void this.svc.enviarPush(id, dto.titulo.trim(), corpo || 'Novo aviso com anexo.', p.ids);
    return { id };
  }

  @Patch('avisos/:id')
  async editar(@Me() u: SessionUser, @Param('id', ParseIntPipe) id: number, @Body() dto: AvisoDto, @Req() req: Request) {
    const p = await this.publico(dto);
    const corpo = this.corpo(dto);
    this.checarAnexos(dto.anexos);
    const r = await this.db.query('UPDATE sistema.avisos SET titulo=$2, corpo=$3, para_todos=$4, para_cidades=$5, editado_em=now() WHERE id=$1 RETURNING id', [id, dto.titulo.trim(), corpo, p.todos, p.cidades]);
    if (!r.rowCount) throw new NotFoundException();
    await this.db.query('DELETE FROM sistema.aviso_destinos WHERE aviso_id=$1', [id]);
    if (p.pessoas) await this.db.query('INSERT INTO sistema.aviso_destinos (aviso_id, user_id) SELECT $1, unnest($2::int[])', [id, p.pessoas]);
    await this.anexos(id, dto.anexos);
    await this.aud.registrar('admin_editou_aviso', { ator: u.id, req, detalhe: { aviso: id, titulo: dto.titulo.trim(), para: p.texto } });
    return { ok: true };
  }

  @Delete('avisos/:id')
  @HttpCode(200)
  async excluir(@Me() u: SessionUser, @Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const chaves = (await this.db.query('SELECT chave FROM sistema.aviso_anexos WHERE aviso_id=$1 AND chave IS NOT NULL', [id])).rows;
    const r = await this.db.query('DELETE FROM sistema.avisos WHERE id=$1 RETURNING titulo', [id]);
    if (!r.rowCount) throw new NotFoundException();
    for (const c of chaves) await this.storage.remove(c.chave).catch(() => undefined);
    await this.aud.registrar('admin_excluiu_aviso', { ator: u.id, req, detalhe: { aviso: id, titulo: r.rows[0].titulo } });
    return { ok: true };
  }
}

@Module({ providers: [AvisosService], controllers: [NotificacoesController, AvisosAdminController], exports: [AvisosService] })
export class AvisosModule {}
