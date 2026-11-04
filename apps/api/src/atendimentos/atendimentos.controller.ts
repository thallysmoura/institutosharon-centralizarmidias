import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Patch, ParseIntPipe, Post, Query, Req, Res, NotFoundException, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { memoryStorage } from 'multer';
import sharp from 'sharp';
import { DbService } from '../db/db.service';
import { StorageService } from '../storage/storage.service';
import { EventosService } from '../eventos/eventos.service';
import { AuditoriaService } from '../db/auditoria.service';
import { dispositivoDe, PresencaService } from '../presenca/presenca.service';
import { AuthGuard, Me, Roles, SessionUser } from '../common/auth';
import { soDigitos } from '../common/cpf';


const MAX_BYTES = 25 * 1024 * 1024; // por foto (iPhone em alta resolução passa de 10 MB; o servidor reduz a imagem ao guardar)
const MAX_ENVIO_BYTES = 95 * 1024 * 1024; // soma de todos os arquivos de um envio (a hospedagem recusa corpo acima de 100 MB)
const MAX_FILES = 10;
const MAX_VIDEOS = 3;
const MAX_VIDEO_BYTES = 90 * 1024 * 1024; // por vídeo
const MAX_POSTER_BYTES = 3 * 1024 * 1024;

/** Vídeo MP4/MOV (caixa `ftyp`) ou WebM (EBML), pelo conteúdo; devolve o tipo e a extensão, ou null. */
function videoValido(b: Buffer): { mime: string; ext: string } | null {
  if (b.length < 16) return null;
  if (b.toString('ascii', 4, 8) === 'ftyp') return b.toString('ascii', 8, 12) === 'qt  ' ? { mime: 'video/quicktime', ext: 'mov' } : { mime: 'video/mp4', ext: 'mp4' };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { mime: 'video/webm', ext: 'webm' };
  return null;
}

/** Valida o formato real pelo conteúdo (JPEG, PNG ou WebP), não pelo nome/mimetype informado. */
function formatoValido(b: Buffer) {
  if (b.length < 12) return false;
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const webp = b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
  return jpeg || png || webp;
}

class PapelDto {
  @IsIn(['ALUNO', 'ADMIN']) role!: 'ALUNO' | 'ADMIN';
}

class EditarDto {
  @IsString() @MinLength(2) @MaxLength(80) @Matches(/^[^<>{}`$\\]+$/, { message: 'O identificador não pode ter < > { } ` $ ou barra invertida.' }) identificador!: string;
}

class CriarDto {
  @IsString() @MinLength(2) @MaxLength(80) @Matches(/^[^<>{}`$\\]+$/, { message: 'O identificador não pode ter < > { } ` $ ou barra invertida.' }) identificador!: string;
  @IsOptional() @IsString() @MaxLength(200) duracoes?: string; // JSON com a duração (s) de cada vídeo, na ordem enviada
}

const SELECT_ATEND = `
  SELECT a.id, a.identificador_paciente, a.created_at, c.nome AS cidade,
         json_build_object('id', u.id, 'nome', u.nome, 'matricula', u.matricula, 'email', u.email, 'foto', CASE WHEN u.foto_key IS NOT NULL OR u.foto_url IS NOT NULL THEN '/users/' || u.id || '/foto?v=' || u.foto_v END) AS aluno,
         COALESCE(json_agg(json_build_object('id', f.id, 'created_at', f.created_at, 'oculta', f.oculta_em IS NOT NULL, 'bytes', f.bytes, 'width', f.width, 'height', f.height, 'tipo', f.tipo, 'duracao', f.duracao, 'dispositivo', f.dispositivo, 'so', f.so, 'navegador', f.navegador) ORDER BY f.id) FILTER (WHERE f.id IS NOT NULL), '[]') AS fotos
  FROM sistema.atendimentos a
  JOIN sistema.users u ON u.id = a.aluno_id
  JOIN sistema.cidades c ON c.id = a.cidade_id
  LEFT JOIN sistema.fotos f ON f.atendimento_id = a.id`;

/** Visão do aluno: fotos que ele excluiu ficam ocultas (continuam guardadas até o administrador excluir em definitivo). */
const SELECT_ATEND_ALUNO = SELECT_ATEND.replace('ON f.atendimento_id = a.id', 'ON f.atendimento_id = a.id AND f.oculta_em IS NULL');

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
@Roles('ALUNO', 'ADMIN')
export class AtendimentosController {
  constructor(private readonly db: DbService, private readonly storage: StorageService, private readonly eventos: EventosService, private readonly aud: AuditoriaService) {}

  @Post()
  @UseInterceptors(FileFieldsInterceptor([{ name: 'fotos', maxCount: MAX_FILES }, { name: 'videos', maxCount: MAX_VIDEOS }, { name: 'posters', maxCount: MAX_VIDEOS }], { storage: memoryStorage(), limits: { fileSize: MAX_ENVIO_BYTES, files: MAX_FILES + MAX_VIDEOS * 2 } }))
  async criar(@Me() u: SessionUser, @Body() dto: CriarDto, @UploadedFiles() enviados: { fotos?: Express.Multer.File[]; videos?: Express.Multer.File[]; posters?: Express.Multer.File[] }, @Req() req: Request) {
    const disp = dispositivoDe(req.headers['user-agent'] ?? '');
    const files = enviados?.fotos ?? [];
    const videos = enviados?.videos ?? [];
    const posters = enviados?.posters ?? [];
    if (!files.length && !videos.length) throw new BadRequestException('Envie ao menos uma foto ou vídeo.');
    const mb = (b: number) => `${(b / 1048576).toFixed(1).replace('.', ',')} MB`;
    const tooBig = files.find((f) => f.size > MAX_BYTES);
    if (tooBig) throw new BadRequestException(`Foto muito grande (${mb(tooBig.size)}). O máximo é ${mb(MAX_BYTES)} por foto.`);
    const vidBig = videos.find((f) => f.size > MAX_VIDEO_BYTES);
    if (vidBig) throw new BadRequestException(`Vídeo muito grande (${mb(vidBig.size)}). O máximo é ${mb(MAX_VIDEO_BYTES)} por vídeo.`);
    const somaEnvio = [...files, ...videos, ...posters].reduce((t, f) => t + f.size, 0);
    if (somaEnvio > MAX_ENVIO_BYTES) throw new BadRequestException(`O envio tem ${mb(somaEnvio)}. O máximo é ${mb(MAX_ENVIO_BYTES)} por envio.`);
    if (posters.some((f) => f.size > MAX_POSTER_BYTES)) throw new BadRequestException('Prévia do vídeo muito grande.');
    const infoVideos = videos.map((v) => videoValido(v.buffer));
    if (infoVideos.some((i) => !i)) throw new BadRequestException('Vídeo inválido. Use MP4, MOV ou WebM.');
    let duracoes: number[] = [];
    try { duracoes = JSON.parse(dto.duracoes ?? '[]'); } catch { duracoes = []; }
    if (duracoes.some((d) => Number(d) > 16)) throw new BadRequestException('Cada vídeo pode ter no máximo 15 segundos.');
    // A cidade vem da sessão (localização do login) e não pode ser escolhida no envio.
    let cidadeId = u.cidade_id;
    if (!cidadeId && u.role === 'ADMIN') {
      // administrador fora de uma localidade cadastrada: usa a cidade do cadastro ou a primeira da lista
      cidadeId = (await this.db.query('SELECT COALESCE((SELECT cidade_id FROM sistema.users WHERE id=$1), (SELECT id FROM sistema.cidades ORDER BY id LIMIT 1)) AS id', [u.id])).rows[0]?.id ?? null;
    }
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
        'INSERT INTO sistema.fotos (atendimento_id, storage_key, thumb_key, bytes, thumb_bytes, width, height, dispositivo, so, navegador) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [atendimentoId, key, thumbKey, full.data.length, thumb.length, full.info.width, full.info.height, disp.dispositivo, disp.so, disp.navegador],
      );
    }
    for (const [k, v] of videos.entries()) {
      const info = infoVideos[k]!;
      const id = randomUUID();
      const key = `${u.id}/${atendimentoId}/${id}.${info.ext}`;
      // a prévia vem do aparelho (um quadro do vídeo); o nome do arquivo traz o índice do vídeo a que pertence
      const poster = posters.find((p) => p.originalname.startsWith(`${k}.`)) ?? posters[k];
      let thumbKey: string | null = null;
      let thumbBytes = 0;
      let largura: number | null = null;
      let altura: number | null = null;
      if (poster && formatoValido(poster.buffer)) {
        const base = sharp(poster.buffer, { failOn: 'none' }).rotate();
        const meta = await base.clone().metadata();
        largura = meta.width ?? null;
        altura = meta.height ?? null;
        const thumb = await base.clone().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
        thumbKey = `${u.id}/${atendimentoId}/${id}-t.webp`;
        thumbBytes = thumb.length;
        await this.storage.put(thumbKey, thumb, 'image/webp');
      }
      await this.storage.put(key, v.buffer, info.mime);
      const dur = Number(duracoes[k]);
      await this.db.query(
        "INSERT INTO sistema.fotos (atendimento_id, storage_key, thumb_key, bytes, thumb_bytes, width, height, dispositivo, so, navegador, tipo, duracao, mime) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'video',$11,$12)",
        [atendimentoId, key, thumbKey, v.buffer.length, thumbBytes, largura, altura, disp.dispositivo, disp.so, disp.navegador, Number.isFinite(dur) && dur > 0 && dur < 86400 ? dur : null, info.mime],
      );
    }
    this.eventos.novoAtendimento(atendimentoId); // painel do administrador atualiza em tempo real
    this.aud.registrar('envio_fotos', { ator: u.id, atendimento: atendimentoId, req, detalhe: { paciente: ident, quantidade: files.length, videos: videos.length } });
    return { atendimentoId, enviadas: files.length + videos.length };
  }

  /** O aluno corrige o nome/identificador do paciente de um atendimento dele (vale para todas as fotos do atendimento). */
  @Patch(':id')
  async editar(@Me() u: SessionUser, @Param('id', ParseIntPipe) id: number, @Body() dto: EditarDto, @Req() req: Request) {
    const novo = dto.identificador.trim();
    const a = (await this.db.query('SELECT identificador_paciente FROM sistema.atendimentos WHERE id=$1 AND aluno_id=$2', [id, u.id])).rows[0];
    if (!a) throw new NotFoundException();
    if (a.identificador_paciente === novo) return { ok: true };
    await this.db.query('UPDATE sistema.atendimentos SET identificador_paciente=$2 WHERE id=$1', [id, novo]);
    await this.aud.registrar('aluno_editou_paciente', { ator: u.id, atendimento: id, req, detalhe: { de: a.identificador_paciente, para: novo } });
    this.eventos.novoAtendimento(id); // o painel do administrador atualiza o nome
    return { ok: true };
  }

  @Get('meus')
  async meus(@Me() u: SessionUser) {
    const r = await this.db.query(`${SELECT_ATEND_ALUNO} WHERE a.aluno_id=$1 GROUP BY a.id, c.nome, u.id HAVING count(f.id) > 0 ORDER BY a.created_at DESC LIMIT 100`, [u.id]);
    return r.rows;
  }

  /** O aluno "exclui" a foto: ela só fica oculta para ele. Nada é apagado do armazenamento; fica no log e o administrador é avisado. */
  @Delete('fotos/:id')
  @HttpCode(200)
  async ocultarFoto(@Me() u: SessionUser, @Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const r = await this.db.query(
      `UPDATE sistema.fotos f SET oculta_em=now(), oculta_por=$2 FROM sistema.atendimentos a
        WHERE f.id=$1 AND a.id=f.atendimento_id AND a.aluno_id=$2 AND f.oculta_em IS NULL
        RETURNING f.id, a.id AS atendimento_id, a.identificador_paciente`,
      [id, u.id],
    );
    const f = r.rows[0];
    if (!f) throw new NotFoundException();
    const aluno = { id: u.id, nome: u.nome, matricula: u.matricula };
    await this.aud.registrar('aluno_ocultou_foto', { ator: u.id, foto: f.id, atendimento: f.atendimento_id, req, detalhe: { paciente: f.identificador_paciente, aluno } });
    this.eventos.exclusao({ foto_id: f.id, atendimento_id: f.atendimento_id, paciente: f.identificador_paciente, aluno });
    return { ok: true };
  }
}

@Controller('admin')
@UseGuards(AuthGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly db: DbService, private readonly storage: StorageService, private readonly eventos: EventosService, private readonly presenca: PresencaService, private readonly aud: AuditoriaService) {}

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
      // Limites gratuitos mensais do Cloudflare R2 (Standard) e preços excedentes (USD) - referência pública da Cloudflare
      limites: { bytes: 10 * 1024 ** 3, classeA: 1_000_000, classeB: 10_000_000 },
      precos: { gbMes: 0.015, classeA: 4.5 / 1_000_000, classeB: 0.36 / 1_000_000 },
    };
  }

  @Get('cidades')
  async cidades() {
    return (await this.db.query(
      "SELECT c.id, c.nome, (SELECT count(*)::int FROM sistema.users u WHERE u.cidade_id=c.id AND u.role='ALUNO') AS alunos, (SELECT count(*)::int FROM sistema.fotos f JOIN sistema.atendimentos a ON a.id=f.atendimento_id WHERE a.cidade_id=c.id) AS fotos, (SELECT count(*)::int FROM sistema.atendimentos a WHERE a.cidade_id=c.id) AS atendimentos, (SELECT max(a.created_at) FROM sistema.atendimentos a WHERE a.cidade_id=c.id) AS ultimo FROM sistema.cidades c ORDER BY c.nome",
    )).rows;
  }

  @Get('resumo')
  async resumo() {
    return (await this.db.query(
      "SELECT (SELECT count(*)::int FROM sistema.fotos) AS fotos, (SELECT count(*)::int FROM sistema.fotos WHERE oculta_em IS NOT NULL) AS ocultas, (SELECT count(DISTINCT lower(identificador_paciente))::int FROM sistema.atendimentos) AS pacientes, (SELECT count(*)::int FROM sistema.users WHERE role='ALUNO') AS alunos, (SELECT count(*)::int FROM sistema.cidades) AS cidades",
    )).rows[0];
  }

  /** Controle de acesso: todos os usuários e o papel de cada um (aluno ou administrador). */
  @Get('acessos')
  async acessos() {
    return (await this.db.query(
      `SELECT u.id, u.nome, u.email, u.role, u.matricula, u.cpf, u.origem, u.created_at, u.ultimo_acesso, c.nome AS cidade, u.cidade_id,
              CASE WHEN u.foto_key IS NOT NULL OR u.foto_url IS NOT NULL THEN '/users/' || u.id || '/foto?v=' || u.foto_v END AS foto_url,
              (SELECT count(*)::int FROM sistema.fotos f JOIN sistema.atendimentos a ON a.id=f.atendimento_id WHERE a.aluno_id=u.id) AS fotos
       FROM sistema.users u LEFT JOIN sistema.cidades c ON c.id=u.cidade_id
       ORDER BY (u.role='ADMIN') DESC, u.nome`,
    )).rows;
  }

  /** Presença atual (online, ausente, offline) com aparelho de quem enviou batida; leve, só memória. */
  @Get('presenca')
  presencaAtual() {
    return this.presenca.todos();
  }

  /** Define se o usuário é aluno ou administrador. Não é possível alterar o próprio papel. */
  @Patch('acessos/:id')
  async definirPapel(@Me() eu: SessionUser, @Param('id', ParseIntPipe) id: number, @Body() dto: PapelDto, @Req() req: Request) {
    if (id === eu.id) throw new BadRequestException('Você não pode alterar o seu próprio papel.');
    const r = await this.db.query('UPDATE sistema.users SET role=$2 WHERE id=$1 RETURNING id', [id, dto.role]);
    if (!r.rowCount) throw new NotFoundException();
    await this.aud.registrar('admin_alterou_papel', { ator: eu.id, req, detalhe: { usuario_id: id, novo_papel: dto.role } });
    return { ok: true };
  }

  /** Busca de aluno para filtros: só com 3+ caracteres e no máximo 20 resultados (escala para muitos cadastros). */
  @Get('alunos/busca')
  async buscarAlunos(@Query('q') q = '') {
    const t = q.trim();
    if (t.length < 3) return [];
    const like = `%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    return (await this.db.query(
      "SELECT u.id, u.nome, u.matricula, c.nome AS cidade FROM sistema.users u LEFT JOIN sistema.cidades c ON c.id=u.cidade_id WHERE u.role='ALUNO' AND (u.nome ILIKE $1 OR u.matricula ILIKE $1 OR u.email ILIKE $1) ORDER BY u.nome LIMIT 20",
      [like],
    )).rows;
  }

  /** Alunos: busca (nome, e-mail, matrícula), cidade e ordem no servidor, paginado (30 por página). As contagens só são calculadas para a página devolvida. */
  @Get('alunos')
  async alunos(@Query('q') q = '', @Query('cidade') cidade = '', @Query('ordem') ordem = 'nome', @Query('pagina') pagina = '0') {
    const POR = 30;
    const p: unknown[] = [];
    const w = ["u.role='ALUNO'"];
    const t = q.trim().slice(0, 80);
    if (t) { p.push(`%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%`); const dig = soDigitos(t); w.push(`(u.nome ILIKE $${p.length} OR u.email ILIKE $${p.length} OR u.matricula ILIKE $${p.length}${dig.length >= 3 ? ` OR u.cpf LIKE '%${dig}%'` : ''})`); }
    if (/^\d+$/.test(cidade)) { p.push(Number(cidade)); w.push(`u.cidade_id = $${p.length}`); }
    const ord = ordem === 'recentes' ? 'u.created_at DESC, u.id DESC' : ordem === 'antigos' ? 'u.created_at, u.id' : 'u.nome, u.id';
    const pg = Math.max(0, Math.min(100000, parseInt(pagina, 10) || 0));
    const r = (await this.db.query(
      `WITH pag AS (SELECT u.id, count(*) OVER()::int AS total FROM sistema.users u WHERE ${w.join(' AND ')} ORDER BY ${ord} LIMIT ${POR} OFFSET ${pg * POR})
       SELECT u.id, u.nome, u.email, u.matricula, u.cpf, u.created_at, c.nome AS cidade, pag.total,
              CASE WHEN u.foto_key IS NOT NULL OR u.foto_url IS NOT NULL THEN '/users/' || u.id || '/foto?v=' || u.foto_v END AS foto,
              (SELECT count(*)::int FROM sistema.atendimentos a WHERE a.aluno_id=u.id) AS atendimentos,
              (SELECT count(f.id)::int FROM sistema.fotos f JOIN sistema.atendimentos a ON a.id=f.atendimento_id WHERE a.aluno_id=u.id AND f.oculta_em IS NULL) AS fotos
         FROM pag JOIN sistema.users u ON u.id=pag.id LEFT JOIN sistema.cidades c ON c.id=u.cidade_id ORDER BY ${ord}`, p)).rows;
    let total = r[0]?.total ?? 0;
    if (!r.length && pg > 0) total = (await this.db.query(`SELECT count(*)::int AS n FROM sistema.users u WHERE ${w.join(' AND ')}`, p)).rows[0].n;
    return { itens: r.map(({ total: _t, ...x }) => x), total, porPagina: POR };
  }

  /** Pacientes: busca (código/nome), cidade e ordem no servidor, paginado (20 por página), com as fotos mais recentes de cada um como prévia. */
  @Get('pacientes')
  async pacientes(@Query('q') q = '', @Query('cidade') cidade = '', @Query('ordem') ordem = 'recentes', @Query('pagina') pagina = '0') {
    const POR = 20;
    const p: unknown[] = [];
    const w: string[] = [];
    const t = q.trim().slice(0, 80);
    if (t) { p.push(`%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%`); w.push(`a.identificador_paciente ILIKE $${p.length}`); }
    if (/^\d+$/.test(cidade)) { p.push(Number(cidade)); w.push(`a.cidade_id = $${p.length}`); }
    const ord = ordem === 'fotos' ? 'fotos DESC, ultima DESC' : ordem === 'atendimentos' ? 'atendimentos DESC, ultima DESC' : ordem === 'nome' ? 'chave' : 'ultima DESC';
    const pg = Math.max(0, Math.min(100000, parseInt(pagina, 10) || 0));
    const r = (await this.db.query(
      `WITH pag AS (
         SELECT lower(a.identificador_paciente) AS chave, min(a.identificador_paciente) AS identificador, count(DISTINCT a.id)::int AS atendimentos,
                count(DISTINCT a.aluno_id)::int AS alunos, count(f.id)::int AS fotos, max(a.created_at) AS ultima, count(*) OVER()::int AS total
           FROM sistema.atendimentos a LEFT JOIN sistema.fotos f ON f.atendimento_id=a.id AND f.oculta_em IS NULL
          ${w.length ? 'WHERE ' + w.join(' AND ') : ''} GROUP BY lower(a.identificador_paciente) ORDER BY ${ord} LIMIT ${POR} OFFSET ${pg * POR})
       SELECT pag.*, COALESCE((SELECT json_agg(x) FROM (SELECT f.id FROM sistema.fotos f JOIN sistema.atendimentos a ON a.id=f.atendimento_id
                WHERE lower(a.identificador_paciente)=pag.chave AND f.oculta_em IS NULL ${w.length > 1 || (w.length === 1 && cidade) ? (cidade && /^\d+$/.test(cidade) ? `AND a.cidade_id = $${p.length}` : '') : ''}
                ORDER BY f.created_at DESC, f.id DESC LIMIT 8) x), '[]') AS previas
         FROM pag ORDER BY ${ord}`, p)).rows;
    let total = r[0]?.total ?? 0;
    if (!r.length && pg > 0) total = (await this.db.query(`SELECT count(DISTINCT lower(a.identificador_paciente))::int AS n FROM sistema.atendimentos a ${w.length ? 'WHERE ' + w.join(' AND ') : ''}`, p)).rows[0].n;
    return { itens: r.map(({ total: _t, chave: _c, ...x }) => x), total, porPagina: POR };
  }

  /** Canal de tempo real (SSE) do painel: avisa quando chegam novos envios. */
  @Get('eventos')
  eventosStream(@Res() res: Response) {
    res.set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    if (!this.eventos.registrar(res)) {
      res.status(503).json({ message: 'Muitas conexões em tempo real.' });
      return;
    }
    res.flushHeaders();
    res.write('retry: 3000\n\n');
  }

  /** Fotos que alunos excluíram (ocultas): o administrador decide restaurar ou excluir em definitivo. */
  @Get('exclusoes')
  async exclusoes() {
    return (await this.db.query(
      `SELECT f.id, f.atendimento_id, f.oculta_em, a.identificador_paciente, c.nome AS cidade,
              json_build_object('id', u.id, 'nome', u.nome, 'matricula', u.matricula) AS aluno
         FROM sistema.fotos f JOIN sistema.atendimentos a ON a.id=f.atendimento_id
         JOIN sistema.users u ON u.id=a.aluno_id JOIN sistema.cidades c ON c.id=a.cidade_id
        WHERE f.oculta_em IS NOT NULL ORDER BY f.oculta_em DESC LIMIT 200`,
    )).rows;
  }

  @Post('fotos/:id/restaurar')
  @HttpCode(200)
  async restaurar(@Me() u: SessionUser, @Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const r = await this.db.query('UPDATE sistema.fotos SET oculta_em=NULL, oculta_por=NULL WHERE id=$1 AND oculta_em IS NOT NULL RETURNING id, atendimento_id', [id]);
    if (!r.rows[0]) throw new NotFoundException();
    await this.aud.registrar('admin_restaurou_foto', { ator: u.id, foto: id, atendimento: r.rows[0].atendimento_id, req });
    return { ok: true };
  }

  /** Exclusão definitiva (só administrador): remove os arquivos do armazenamento e o registro. */
  @Delete('fotos/:id')
  @HttpCode(200)
  async excluirDefinitivo(@Me() u: SessionUser, @Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const f = (await this.db.query('SELECT f.id, f.storage_key, f.thumb_key, f.atendimento_id, f.oculta_em, a.aluno_id, a.identificador_paciente FROM sistema.fotos f JOIN sistema.atendimentos a ON a.id=f.atendimento_id WHERE f.id=$1', [id])).rows[0];
    if (!f) throw new NotFoundException();
    await this.storage.remove(f.storage_key);
    if (f.thumb_key) await this.storage.remove(f.thumb_key);
    await this.db.query('DELETE FROM sistema.fotos WHERE id=$1', [id]);
    await this.db.query('DELETE FROM sistema.atendimentos a WHERE a.id=$1 AND NOT EXISTS (SELECT 1 FROM sistema.fotos WHERE atendimento_id=a.id)', [f.atendimento_id]);
    await this.aud.registrar('admin_excluiu_foto', { ator: u.id, foto: id, atendimento: f.atendimento_id, req, detalhe: { paciente: f.identificador_paciente, aluno_id: f.aluno_id, ocultada_pelo_aluno: !!f.oculta_em } });
    return { ok: true };
  }

  @Get('atendimentos')
  async listar(@Query('ids') ids?: string, @Query('cidade') cidade?: string, @Query('aluno') aluno?: string, @Query('aluno_id') alunoId?: string, @Query('de') de?: string, @Query('ate') ate?: string, @Query('q') q?: string, @Query('cursor') cursor?: string, @Query('limite') limite?: string, @Query('paciente') paciente?: string) {
    const w: string[] = [];
    const p: unknown[] = [];
    const add = (sql: string, v: unknown) => { p.push(v); w.push(sql.replace('?', `$${p.length}`)); };
    if (ids && /^\d+(,\d+){0,29}$/.test(ids)) add('a.id = ANY(?::int[])', ids.split(',').map(Number));
    if (cidade && /^\d+$/.test(cidade)) add('a.cidade_id = ?', Number(cidade));
    if (aluno?.trim()) { p.push(`%${aluno.trim()}%`); w.push(`(u.nome ILIKE $${p.length} OR u.matricula ILIKE $${p.length})`); }
    if (alunoId && /^\d+$/.test(alunoId)) add('a.aluno_id = ?', Number(alunoId));
    if (de && /^\d{4}-\d{2}-\d{2}$/.test(de)) add('a.created_at >= ?::date', de);
    if (ate && /^\d{4}-\d{2}-\d{2}$/.test(ate)) add("a.created_at < (?::date + interval '1 day')", ate);
    if (q?.trim()) add('a.identificador_paciente ILIKE ?', `%${q.trim()}%`);
    if (paciente?.trim()) add('lower(a.identificador_paciente) = lower(?)', paciente.trim());
    const m = cursor && /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)_(\d+)$/.exec(cursor);
    if (m) { p.push(m[1], Number(m[2])); w.push(`(a.created_at, a.id) < ($${p.length - 1}::timestamptz, $${p.length}::int)`); }
    const n = Math.min(Math.max(parseInt(limite ?? '', 10) || 30, 1), 60);
    // 1) só os ids da página (usa o índice por data, sem juntar as fotos de tudo); 2) monta os atendimentos dessa página
    const pag = (await this.db.query(
      `SELECT a.id, to_char(a.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cur FROM sistema.atendimentos a JOIN sistema.users u ON u.id = a.aluno_id
        ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY a.created_at DESC, a.id DESC LIMIT ${n + 1}`, p)).rows;
    const mais = pag.length > n;
    const pagina = pag.slice(0, n);
    const itens = pagina.length ? (await this.db.query(`${SELECT_ATEND} WHERE a.id = ANY($1::int[]) GROUP BY a.id, c.nome, u.id ORDER BY a.created_at DESC, a.id DESC`, [pagina.map((x) => x.id)])).rows : [];
    return { itens, proximo: mais ? `${pagina[pagina.length - 1].cur}_${pagina[pagina.length - 1].id}` : null };
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
    const r = await this.db.query('SELECT f.storage_key, f.thumb_key, f.oculta_em, f.tipo, f.mime, a.aluno_id FROM sistema.fotos f JOIN sistema.atendimentos a ON a.id=f.atendimento_id WHERE f.id=$1', [id]);
    const f = r.rows[0];
    if (!f || (u.role !== 'ADMIN' && (f.aluno_id !== u.id || f.oculta_em))) throw new NotFoundException();
    const miniatura = variant === 'thumb' && f.thumb_key;
    if (variant === 'thumb' && f.tipo === 'video' && !f.thumb_key) throw new NotFoundException(); // vídeo sem prévia: o front mostra um ícone
    const key: string = miniatura ? f.thumb_key : f.storage_key;
    const video = f.tipo === 'video' && !miniatura;
    const ext = video ? (String(f.mime).includes('webm') ? 'webm' : String(f.mime).includes('quicktime') ? 'mov' : 'mp4') : 'webp';
    const url = await this.storage.urlAssinada(key, download ? `sharon-${id}.${ext}` : undefined);
    if (url) {
      res.set({ 'Cache-Control': 'private, max-age=240' });
      return res.redirect(302, url);
    }
    const corpo = await this.storage.get(key);
    res.set({ 'Content-Type': video ? f.mime : 'image/webp', 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes', ...(download ? { 'Content-Disposition': `attachment; filename="sharon-${id}.${ext}"` } : {}) });
    const faixa = /^bytes=(\d*)-(\d*)$/.exec(String(res.req.headers.range ?? ''));
    if (video && faixa && (faixa[1] || faixa[2])) {
      const ini = faixa[1] ? Number(faixa[1]) : Math.max(0, corpo.length - Number(faixa[2]));
      const fim = faixa[1] && faixa[2] ? Math.min(Number(faixa[2]), corpo.length - 1) : corpo.length - 1;
      if (ini > fim || ini >= corpo.length) { res.status(416).set('Content-Range', `bytes */${corpo.length}`).end(); return; }
      res.status(206).set({ 'Content-Range': `bytes ${ini}-${fim}/${corpo.length}`, 'Content-Length': String(fim - ini + 1) });
      res.send(corpo.subarray(ini, fim + 1));
      return;
    }
    res.send(corpo);
  }

}
