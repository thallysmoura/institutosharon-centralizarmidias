import { BadRequestException, Body, ConflictException, Controller, Get, Param, Patch, ParseIntPipe, Post, Query, Res, NotFoundException, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { memoryStorage } from 'multer';
import sharp from 'sharp';
import { DbService } from '../db/db.service';
import { StorageService } from '../storage/storage.service';
import { AuthGuard, Me, Roles, SessionUser } from '../common/auth';


const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 10;

/** Valida o formato real pelo conteúdo (JPEG, PNG ou WebP), não pelo nome/mimetype informado. */
function formatoValido(b: Buffer) {
  if (b.length < 12) return false;
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const webp = b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
  return jpeg || png || webp;
}

class AcessoDto {
  @IsOptional() @IsString() @MaxLength(30) matricula?: string;
  @IsOptional() @IsBoolean() autorizado?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() cidade_id?: number;
}

class CriarDto {
  @IsString() @MinLength(2) @MaxLength(80) identificador!: string;
}

const SELECT_ATEND = `
  SELECT a.id, a.identificador_paciente, a.created_at, c.nome AS cidade,
         json_build_object('id', u.id, 'nome', u.nome, 'matricula', u.matricula) AS aluno,
         COALESCE(json_agg(json_build_object('id', f.id, 'created_at', f.created_at) ORDER BY f.id) FILTER (WHERE f.id IS NOT NULL), '[]') AS fotos
  FROM sistema.atendimentos a
  JOIN sistema.users u ON u.id = a.aluno_id
  JOIN sistema.cidades c ON c.id = a.cidade_id
  LEFT JOIN sistema.fotos f ON f.atendimento_id = a.id`;

@Controller('cidades')
@UseGuards(AuthGuard)
export class CidadesController {
  constructor(private readonly db: DbService) {}

  /** Localidades cadastradas (o aluno escolhe uma quando não permite a localização do navegador). */
  @Get()
  async listar() {
    return (await this.db.query('SELECT id, nome, lat, lng FROM sistema.cidades ORDER BY nome')).rows;
  }
}

@Controller('atendimentos')
@UseGuards(AuthGuard)
@Roles('ALUNO')
export class AtendimentosController {
  constructor(private readonly db: DbService, private readonly storage: StorageService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('fotos', MAX_FILES, { storage: memoryStorage(), limits: { fileSize: MAX_BYTES, files: MAX_FILES } }))
  async criar(@Me() u: SessionUser, @Body() dto: CriarDto, @UploadedFiles() files: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException('Envie ao menos uma foto.');
    // A cidade vem da sessão (localização do login) e não pode ser escolhida no envio.
    const cidadeId = u.cidade_id;
    if (!cidadeId) throw new BadRequestException('Sua localização não corresponde a uma localidade cadastrada. Procure a administração.');
    if (files.some((f) => !formatoValido(f.buffer))) throw new BadRequestException('Formato inválido. Use JPEG, PNG ou WebP.');

    const ident = dto.identificador.trim();
    const ex = await this.db.query(
      'SELECT id FROM sistema.atendimentos WHERE aluno_id=$1 AND lower(trim(identificador_paciente))=lower($2) AND created_at::date = current_date ORDER BY id LIMIT 1',
      [u.id, ident],
    );
    const atendimentoId: number =
      ex.rows[0]?.id ??
      (await this.db.query('INSERT INTO sistema.atendimentos (identificador_paciente, aluno_id, cidade_id) VALUES ($1,$2,$3) RETURNING id', [ident, u.id, cidadeId])).rows[0].id;

    for (const f of files) {
      // Qualidade alta e arquivo leve: original reduzido a 2560 px (WebP q88) + miniatura 480 px para listas rápidas
      const base = sharp(f.buffer, { failOn: 'none' }).rotate();
      const [full, thumb] = await Promise.all([
        base.clone().resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true }).webp({ quality: 88, effort: 4 }).toBuffer({ resolveWithObject: true }),
        base.clone().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 76 }).toBuffer(),
      ]);
      const id = randomUUID();
      const key = `${u.id}/${atendimentoId}/${id}.webp`;
      const thumbKey = `${u.id}/${atendimentoId}/${id}-t.webp`;
      await Promise.all([this.storage.put(key, full.data, 'image/webp'), this.storage.put(thumbKey, thumb, 'image/webp')]);
      await this.db.query(
        'INSERT INTO sistema.fotos (atendimento_id, storage_key, thumb_key, bytes, thumb_bytes, width, height) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [atendimentoId, key, thumbKey, full.data.length, thumb.length, full.info.width, full.info.height],
      );
    }
    return { atendimentoId, enviadas: files.length };
  }

  @Get('meus')
  async meus(@Me() u: SessionUser) {
    const r = await this.db.query(`${SELECT_ATEND} WHERE a.aluno_id=$1 GROUP BY a.id, c.nome, u.id ORDER BY a.created_at DESC LIMIT 100`, [u.id]);
    return r.rows;
  }
}

@Controller('admin')
@UseGuards(AuthGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly db: DbService, private readonly storage: StorageService) {}

  /** Gestão do armazenamento: uso, quantidade de mídias e operações do mês frente ao limite gratuito do Cloudflare R2. */
  @Get('armazenamento')
  async armazenamento() {
    const t = (await this.db.query(
      'SELECT count(*)::int AS fotos, COALESCE(sum(bytes),0)::bigint AS bytes, COALESCE(sum(thumb_bytes),0)::bigint AS thumb_bytes, COALESCE(avg(bytes),0)::int AS media FROM sistema.fotos',
    )).rows[0];
    const mes = (await this.db.query("SELECT classe_a, classe_b FROM sistema.r2_uso WHERE mes = to_char(now(),'YYYY-MM')")).rows[0] ?? { classe_a: 0, classe_b: 0 };
    const porCidade = (await this.db.query(
      'SELECT c.nome AS cidade, count(f.id)::int AS fotos, COALESCE(sum(f.bytes + f.thumb_bytes),0)::bigint AS bytes FROM sistema.cidades c LEFT JOIN sistema.atendimentos a ON a.cidade_id=c.id LEFT JOIN sistema.fotos f ON f.atendimento_id=a.id GROUP BY c.nome ORDER BY c.nome',
    )).rows;
    return {
      driver: this.storage.driver,
      bucket: this.storage.driver === 's3' ? this.storage.bucket : null,
      prefixo: this.storage.prefix || null,
      fotos: t.fotos,
      bytes: Number(t.bytes) + Number(t.thumb_bytes),
      mediaBytes: t.media,
      mes: { classeA: mes.classe_a, classeB: mes.classe_b },
      porCidade: porCidade.map((c) => ({ ...c, bytes: Number(c.bytes) })),
      // Limites gratuitos mensais do Cloudflare R2 (Standard) e preços excedentes (USD) — referência pública da Cloudflare
      limites: { bytes: 10 * 1024 ** 3, classeA: 1_000_000, classeB: 10_000_000 },
      precos: { gbMes: 0.015, classeA: 4.5 / 1_000_000, classeB: 0.36 / 1_000_000 },
    };
  }

  @Get('cidades')
  async cidades() {
    return (await this.db.query(
      "SELECT c.id, c.nome, (SELECT count(*)::int FROM sistema.users u WHERE u.cidade_id=c.id AND u.role='ALUNO') AS alunos, (SELECT count(*)::int FROM sistema.fotos f JOIN sistema.atendimentos a ON a.id=f.atendimento_id WHERE a.cidade_id=c.id) AS fotos FROM sistema.cidades c ORDER BY c.nome",
    )).rows;
  }

  @Get('resumo')
  async resumo() {
    return (await this.db.query(
      "SELECT (SELECT count(*)::int FROM sistema.users WHERE role='ALUNO' AND NOT autorizado) AS pendentes, (SELECT count(*)::int FROM sistema.fotos) AS fotos, (SELECT count(DISTINCT lower(identificador_paciente))::int FROM sistema.atendimentos) AS pacientes, (SELECT count(*)::int FROM sistema.users WHERE role='ALUNO') AS alunos, (SELECT count(*)::int FROM sistema.cidades) AS cidades",
    )).rows[0];
  }

  /** Controle de acesso: todos que já entraram (senha ou Google), com status de autorização. */
  @Get('acessos')
  async acessos() {
    return (await this.db.query(
      `SELECT u.id, u.nome, u.email, u.matricula, u.autorizado, u.origem, u.foto_url, u.created_at, u.ultimo_acesso, u.cidade_id, c.nome AS cidade,
              (SELECT count(*)::int FROM sistema.fotos f JOIN sistema.atendimentos a ON a.id=f.atendimento_id WHERE a.aluno_id=u.id) AS fotos
       FROM sistema.users u LEFT JOIN sistema.cidades c ON c.id=u.cidade_id
       WHERE u.role='ALUNO' ORDER BY u.autorizado ASC, u.ultimo_acesso DESC NULLS LAST, u.created_at DESC`,
    )).rows;
  }

  /** Preenche matrícula/cidade de cadastro e libera (ou revoga) o acesso de um aluno. */
  @Patch('acessos/:id')
  async atualizarAcesso(@Param('id', ParseIntPipe) id: number, @Body() dto: AcessoDto) {
    const sets: string[] = [];
    const p: unknown[] = [id];
    if (dto.matricula !== undefined) { p.push(dto.matricula.trim() || null); sets.push(`matricula=$${p.length}`); }
    if (dto.autorizado !== undefined) { p.push(dto.autorizado); sets.push(`autorizado=$${p.length}`); }
    if (dto.cidade_id !== undefined) {
      if (!(await this.db.query('SELECT 1 FROM sistema.cidades WHERE id=$1', [dto.cidade_id])).rowCount) throw new BadRequestException('Cidade inválida.');
      p.push(dto.cidade_id); sets.push(`cidade_id=$${p.length}`);
    }
    if (!sets.length) throw new BadRequestException('Nada para atualizar.');
    try {
      const r = await this.db.query(`UPDATE sistema.users SET ${sets.join(', ')} WHERE id=$1 AND role='ALUNO' RETURNING id`, p);
      if (!r.rowCount) throw new NotFoundException();
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new ConflictException('Esta matrícula já está em uso por outro aluno.');
      throw e;
    }
    return { ok: true };
  }

  @Get('alunos')
  async alunos() {
    return (await this.db.query(
      "SELECT u.id, u.nome, u.matricula, c.nome AS cidade, (SELECT count(*)::int FROM sistema.atendimentos a WHERE a.aluno_id=u.id) AS atendimentos, (SELECT count(*)::int FROM sistema.fotos f JOIN sistema.atendimentos a ON a.id=f.atendimento_id WHERE a.aluno_id=u.id) AS fotos FROM sistema.users u LEFT JOIN sistema.cidades c ON c.id=u.cidade_id WHERE u.role='ALUNO' ORDER BY u.nome",
    )).rows;
  }

  @Get('pacientes')
  async pacientes() {
    return (await this.db.query(
      'SELECT min(a.identificador_paciente) AS identificador, count(DISTINCT a.aluno_id)::int AS alunos, count(f.id)::int AS fotos, max(a.created_at) AS ultima FROM sistema.atendimentos a LEFT JOIN sistema.fotos f ON f.atendimento_id=a.id GROUP BY lower(a.identificador_paciente) ORDER BY max(a.created_at) DESC LIMIT 500',
    )).rows;
  }

  @Get('atendimentos')
  async listar(@Query('cidade') cidade?: string, @Query('aluno') aluno?: string, @Query('aluno_id') alunoId?: string, @Query('de') de?: string, @Query('ate') ate?: string, @Query('q') q?: string) {
    const w: string[] = [];
    const p: unknown[] = [];
    const add = (sql: string, v: unknown) => { p.push(v); w.push(sql.replace('?', `$${p.length}`)); };
    if (cidade && /^\d+$/.test(cidade)) add('a.cidade_id = ?', Number(cidade));
    if (aluno?.trim()) { p.push(`%${aluno.trim()}%`); w.push(`(u.nome ILIKE $${p.length} OR u.matricula ILIKE $${p.length})`); }
    if (alunoId && /^\d+$/.test(alunoId)) add('a.aluno_id = ?', Number(alunoId));
    if (de && /^\d{4}-\d{2}-\d{2}$/.test(de)) add('a.created_at >= ?::date', de);
    if (ate && /^\d{4}-\d{2}-\d{2}$/.test(ate)) add("a.created_at < (?::date + interval '1 day')", ate);
    if (q?.trim()) add('a.identificador_paciente ILIKE ?', `%${q.trim()}%`);
    const r = await this.db.query(`${SELECT_ATEND} ${w.length ? 'WHERE ' + w.join(' AND ') : ''} GROUP BY a.id, c.nome, u.id ORDER BY a.created_at DESC LIMIT 200`, p);
    return r.rows;
  }
}

@Controller('fotos')
@UseGuards(AuthGuard)
export class FotosController {
  constructor(private readonly db: DbService, private readonly storage: StorageService) {}

  /** Aluno só acessa as próprias fotos; ADMIN acessa todas. Fora disso, 404 (não revela a existência).
   *  `variant=thumb` devolve a miniatura. No R2, responde com redirecionamento para URL assinada (5 min). */
  @Get(':id/arquivo')
  async arquivo(@Me() u: SessionUser, @Param('id', ParseIntPipe) id: number, @Query('download') download: string | undefined, @Query('variant') variant: string | undefined, @Res() res: Response) {
    const r = await this.db.query('SELECT f.storage_key, f.thumb_key, a.aluno_id FROM sistema.fotos f JOIN sistema.atendimentos a ON a.id=f.atendimento_id WHERE f.id=$1', [id]);
    const f = r.rows[0];
    if (!f || (u.role !== 'ADMIN' && f.aluno_id !== u.id)) throw new NotFoundException();
    const key: string = variant === 'thumb' && f.thumb_key ? f.thumb_key : f.storage_key;
    const url = await this.storage.urlAssinada(key, download ? `sharon-${id}.webp` : undefined);
    if (url) {
      res.set({ 'Cache-Control': 'private, max-age=240' });
      return res.redirect(302, url);
    }
    res.set({ 'Content-Type': 'image/webp', 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff', ...(download ? { 'Content-Disposition': `attachment; filename="sharon-${id}.webp"` } : {}) });
    res.send(await this.storage.get(key));
  }

}
