import { Body, Controller, Delete, Get, HttpCode, Injectable, Logger, Module, NotFoundException, OnModuleInit, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { Request } from 'express';
import sanitizeHtml from 'sanitize-html';
import webpush from 'web-push';
import { DbService } from '../db/db.service';
import { AuditoriaService } from '../db/auditoria.service';
import { AuthGuard, Me, Roles, SessionUser } from '../common/auth';

class AvisoDto {
  @IsString() @MinLength(2) @MaxLength(120) titulo!: string;
  @IsString() @MinLength(1) @MaxLength(12000) corpo!: string;
  @IsBoolean() todos!: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsInt({ each: true }) destinatarios?: number[];
}
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

const VISIVEL = '(a.para_todos OR EXISTS (SELECT 1 FROM sistema.aviso_destinos d WHERE d.aviso_id=a.id AND d.user_id=$1))';

/** Notificações do próprio usuário. */
@Controller('notificacoes')
@UseGuards(AuthGuard)
export class NotificacoesController {
  constructor(private readonly db: DbService, private readonly svc: AvisosService) {}

  @Get()
  async listar(@Me() u: SessionUser) {
    const itens = (await this.db.query(
      `SELECT a.id, a.titulo, a.corpo, a.created_at, a.editado_em, x.nome AS autor, CASE WHEN x.foto_key IS NOT NULL OR x.foto_url IS NOT NULL THEN '/users/' || x.id || '/foto?v=' || x.foto_v END AS autor_foto, (l.user_id IS NOT NULL) AS lida
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

/** Mural de avisos (histórico, criar, editar, excluir) e busca de destinatários. */
@Controller('admin')
@UseGuards(AuthGuard)
@Roles('ADMIN')
export class AvisosAdminController {
  constructor(private readonly db: DbService, private readonly svc: AvisosService, private readonly aud: AuditoriaService) {}

  @Get('avisos')
  async historico() {
    return (await this.db.query(
      `SELECT a.id, a.titulo, a.corpo, a.para_todos, a.created_at, a.editado_em, x.nome AS autor, CASE WHEN x.foto_key IS NOT NULL OR x.foto_url IS NOT NULL THEN '/users/' || x.id || '/foto?v=' || x.foto_v END AS autor_foto,
              (SELECT count(*)::int FROM sistema.aviso_leituras l WHERE l.aviso_id=a.id) AS lidos,
              CASE WHEN a.para_todos THEN (SELECT count(*)::int FROM sistema.users) ELSE (SELECT count(*)::int FROM sistema.aviso_destinos d WHERE d.aviso_id=a.id) END AS total,
              COALESCE((SELECT json_agg(json_build_object('id', u.id, 'nome', u.nome, 'email', u.email) ORDER BY u.nome) FROM sistema.aviso_destinos d JOIN sistema.users u ON u.id=d.user_id WHERE d.aviso_id=a.id), '[]') AS destinatarios
         FROM sistema.avisos a LEFT JOIN sistema.users x ON x.id=a.criado_por ORDER BY a.created_at DESC LIMIT 200`)).rows;
  }

  /** Busca qualquer usuário (aluno ou administrador) para escolher destinatários: 3+ caracteres, no máximo 20. */
  @Get('usuarios/busca')
  async buscar(@Query('q') q = '') {
    const t = q.trim();
    if (t.length < 3) return [];
    const like = `%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    return (await this.db.query('SELECT id, nome, email, role, matricula FROM sistema.users WHERE nome ILIKE $1 OR email ILIKE $1 OR matricula ILIKE $1 ORDER BY nome LIMIT 20', [like])).rows;
  }

  private async destinos(dto: AvisoDto) {
    if (dto.todos) return null;
    const ids = [...new Set(dto.destinatarios ?? [])];
    if (!ids.length) throw new BadRequestException('Escolha ao menos uma pessoa ou envie para todos.');
    const ok = (await this.db.query('SELECT id FROM sistema.users WHERE id = ANY($1::int[])', [ids])).rows.map((r) => r.id as number);
    if (ok.length !== ids.length) throw new BadRequestException('Algum destinatário não existe mais.');
    return ids;
  }
  private corpo(dto: AvisoDto) {
    const c = this.svc.limpar(dto.corpo);
    if (!this.svc.texto(c)) throw new BadRequestException('Escreva o texto do aviso.');
    return c;
  }

  @Post('avisos')
  @HttpCode(201)
  async criar(@Me() u: SessionUser, @Body() dto: AvisoDto, @Req() req: Request) {
    const ids = await this.destinos(dto);
    const corpo = this.corpo(dto);
    const id = (await this.db.query('INSERT INTO sistema.avisos (titulo, corpo, para_todos, criado_por) VALUES ($1,$2,$3,$4) RETURNING id', [dto.titulo.trim(), corpo, dto.todos, u.id])).rows[0].id as number;
    if (ids) await this.db.query('INSERT INTO sistema.aviso_destinos (aviso_id, user_id) SELECT $1, unnest($2::int[])', [id, ids]);
    await this.aud.registrar('admin_criou_aviso', { ator: u.id, req, detalhe: { aviso: id, titulo: dto.titulo.trim(), para: dto.todos ? 'todos' : `${ids!.length} pessoa(s)` } });
    void this.svc.enviarPush(id, dto.titulo.trim(), corpo, ids);
    return { id };
  }

  @Patch('avisos/:id')
  async editar(@Me() u: SessionUser, @Param('id', ParseIntPipe) id: number, @Body() dto: AvisoDto, @Req() req: Request) {
    const ids = await this.destinos(dto);
    const corpo = this.corpo(dto);
    const r = await this.db.query('UPDATE sistema.avisos SET titulo=$2, corpo=$3, para_todos=$4, editado_em=now() WHERE id=$1 RETURNING id', [id, dto.titulo.trim(), corpo, dto.todos]);
    if (!r.rowCount) throw new NotFoundException();
    await this.db.query('DELETE FROM sistema.aviso_destinos WHERE aviso_id=$1', [id]);
    if (ids) await this.db.query('INSERT INTO sistema.aviso_destinos (aviso_id, user_id) SELECT $1, unnest($2::int[])', [id, ids]);
    await this.aud.registrar('admin_editou_aviso', { ator: u.id, req, detalhe: { aviso: id, titulo: dto.titulo.trim() } });
    return { ok: true };
  }

  @Delete('avisos/:id')
  @HttpCode(200)
  async excluir(@Me() u: SessionUser, @Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const r = await this.db.query('DELETE FROM sistema.avisos WHERE id=$1 RETURNING titulo', [id]);
    if (!r.rowCount) throw new NotFoundException();
    await this.aud.registrar('admin_excluiu_aviso', { ator: u.id, req, detalhe: { aviso: id, titulo: r.rows[0].titulo } });
    return { ok: true };
  }
}

@Module({ providers: [AvisosService], controllers: [NotificacoesController, AvisosAdminController], exports: [AvisosService] })
export class AvisosModule {}
