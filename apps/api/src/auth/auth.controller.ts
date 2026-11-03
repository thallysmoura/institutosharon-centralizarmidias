import { BadRequestException, Body, ConflictException, Controller, Get, HttpException, NotFoundException, HttpCode, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsBoolean, IsEmail, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import type { Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { DbService } from '../db/db.service';
import { AuditoriaService } from '../db/auditoria.service';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { dominioDescartavel, excedeu } from '../common/seguranca';
import { AllowPendente, AuthGuard, Me, SessionUser } from '../common/auth';
import { FirebaseService } from './firebase.service';
import { SessaoService } from './sessao.service';
import { Throttle } from '@nestjs/throttler';
import { MailService } from '../mail/mail.service';
import { StorageService } from '../storage/storage.service';
import { fotoDoUsuario } from '../common/foto';

/** A localização é pré-requisito do login: sem coordenadas a API recusa (o navegador só as envia com a permissão concedida). */
class Posicao {
  @IsNumber() @Min(-90) @Max(90) lat!: number;
  @IsNumber() @Min(-180) @Max(180) lng!: number;
  @IsOptional() @IsBoolean() lembrar?: boolean;
}

class LoginDto extends Posicao {
  @IsEmail() @MaxLength(160) email!: string;
  @IsString() @MinLength(3) @MaxLength(100) senha!: string;
}

class GoogleDto extends Posicao {
  @IsString() @MinLength(20) @MaxLength(4096) idToken!: string;
}

class EmailDto {
  @IsEmail() @MaxLength(160) email!: string;
}

class ConfirmarSenhaDto extends EmailDto {
  @IsString() @Matches(/^\d{4}$/, { message: 'O código tem 4 números.' }) pin!: string;
}

class RedefinirDto extends EmailDto {
  @IsString() @MinLength(20) @MaxLength(200) token!: string;
  @IsString() @MinLength(8, { message: 'A senha deve ter ao menos 8 caracteres.' }) @MaxLength(100)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'A senha deve ter letras e números.' }) senha!: string;
}

const NOME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ' .-]+$/;

class CadastroEmailDto extends EmailDto {
  @IsOptional() @IsString() @MaxLength(60) nome?: string;
}

class CadastroDto {
  @IsString() @MinLength(2, { message: 'Informe o nome.' }) @MaxLength(60) @Matches(NOME_RE, { message: 'O nome deve ter apenas letras.' }) nome!: string;
  @IsString() @MinLength(2, { message: 'Informe o sobrenome.' }) @MaxLength(60) @Matches(NOME_RE, { message: 'O sobrenome deve ter apenas letras.' }) sobrenome!: string;
  @IsEmail() @MaxLength(160) email!: string;
  @IsString() @MinLength(20) @MaxLength(200) token!: string;
  @IsString() @MinLength(3, { message: 'A matrícula deve ter ao menos 3 caracteres.' }) @MaxLength(30) @Matches(/^[A-Za-z0-9._\-/]+$/, { message: 'Use apenas letras, números e - . _ /' }) matricula!: string;
  @Type(() => Number) @IsInt({ message: 'Selecione a cidade.' }) cidade_id!: number;
  @IsString() @MinLength(8, { message: 'A senha deve ter ao menos 8 caracteres.' }) @MaxLength(100)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, { message: 'A senha deve ter 1 letra maiúscula, 1 número e 1 caractere especial.' }) senha!: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) lat?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) lng?: number;
}

const PIN_TENTATIVAS = 5;
const PIN_INTERVALO_S = 60;
const tentativas = new Map<string, { n: number; ate: number }>();

@Controller('auth')
export class AuthController {
  constructor(
    private readonly db: DbService,
    private readonly cfg: ConfigService,
    private readonly firebase: FirebaseService,
    private readonly mail: MailService,
    private readonly storage: StorageService,
    private readonly sessao: SessaoService,
    private readonly aud: AuditoriaService,
  ) {}

  private hashPin(userId: number, pin: string) {
    return createHmac('sha256', this.cfg.getOrThrow<string>('JWT_SECRET')).update(`senha:${userId}:${pin}`).digest('hex');
  }

  /** Cidades cadastradas (público): usadas na tela de cadastro para a escolha manual quando a localização não é obtida. */
  @Get('cidades')
  async cidades() {
    return (await this.db.query('SELECT id, nome, lat, lng FROM sistema.cidades ORDER BY nome')).rows;
  }

  private hashPinCadastro(email: string, pin: string) {
    return createHmac('sha256', this.cfg.getOrThrow<string>('JWT_SECRET')).update(`cadastro:${email.toLowerCase()}:${pin}`).digest('hex');
  }

  /** Cadastro, passo 1: verifica o e-mail enviando um PIN de 4 dígitos. */
  @Post('cadastro/email/solicitar')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  async solicitarEmailCadastro(@Body() dto: CadastroEmailDto, @Req() req: Request) {
    const email = dto.email.trim().toLowerCase();
    if (dominioDescartavel(email)) throw new BadRequestException('E-mails temporários não são aceitos. Use o seu e-mail pessoal ou institucional.');
    if (excedeu(`cad-ip:${req.ip}`, 10, 3600_000) || excedeu(`cad-em:${email}`, 5, 3600_000)) throw new HttpException('Muitas tentativas. Aguarde alguns minutos e tente novamente.', 429);
    if ((await this.db.query('SELECT 1 FROM sistema.users WHERE lower(email)=$1 OR lower(google_email)=$1', [email])).rowCount)
      throw new ConflictException('Este e-mail já possui cadastro. Entre com a sua senha ou use "Esqueceu sua senha?".');
    const ult = (await this.db.query('SELECT EXTRACT(EPOCH FROM (now()-enviado_em))::int AS seg FROM sistema.pin_cadastro WHERE email=$1', [email])).rows[0];
    if (ult && ult.seg < PIN_INTERVALO_S) throw new HttpException(`Aguarde ${PIN_INTERVALO_S - ult.seg}s para pedir um novo código.`, 429);
    const pin = String(randomInt(0, 10000)).padStart(4, '0');
    await this.db.query(
      `INSERT INTO sistema.pin_cadastro (email, pin_hash, expira, tentativas, enviado_em, token_hash, token_expira) VALUES ($1,$2, now() + interval '10 minutes', 0, now(), NULL, NULL)
       ON CONFLICT (email) DO UPDATE SET pin_hash=EXCLUDED.pin_hash, expira=EXCLUDED.expira, tentativas=0, enviado_em=now(), token_hash=NULL, token_expira=NULL`,
      [email, this.hashPinCadastro(email, pin)],
    );
    await this.mail.enviarPin(email, dto.nome?.trim() || 'Aluno', pin, null, 'cadastro');
    return { ok: true };
  }

  /** Cadastro, passo 2: confere o PIN e devolve um token (30 min) que comprova o e-mail verificado. */
  @Post('cadastro/email/confirmar')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  async confirmarEmailCadastro(@Body() dto: ConfirmarSenhaDto) {
    const email = dto.email.trim().toLowerCase();
    const erro = new BadRequestException('Código incorreto ou expirado. Peça um novo código.');
    const r = (await this.db.query('SELECT pin_hash, tentativas, (expira < now()) AS vencido FROM sistema.pin_cadastro WHERE email=$1 AND pin_hash IS NOT NULL', [email])).rows[0];
    if (!r || r.vencido || r.tentativas >= PIN_TENTATIVAS) {
      await this.db.query('DELETE FROM sistema.pin_cadastro WHERE email=$1', [email]);
      throw erro;
    }
    const a = Buffer.from(this.hashPinCadastro(email, dto.pin));
    const b = Buffer.from(String(r.pin_hash));
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      await this.db.query('UPDATE sistema.pin_cadastro SET tentativas = tentativas + 1 WHERE email=$1', [email]);
      throw new BadRequestException(`Código incorreto. Restam ${PIN_TENTATIVAS - r.tentativas - 1} tentativa(s).`);
    }
    const token = randomBytes(32).toString('hex');
    await this.db.query("UPDATE sistema.pin_cadastro SET pin_hash=NULL, token_hash=$2, token_expira = now() + interval '30 minutes' WHERE email=$1", [email, createHash('sha256').update(token).digest('hex')]);
    return { token };
  }

  /** Cadastro, passo 3: cria a conta de aluno (e-mail já verificado). Com localização, já abre a sessão. */
  @Post('cadastro')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(201)
  async cadastrar(@Body() dto: CadastroDto, @Res({ passthrough: true }) res: Response, @Req() req: Request) {
    const email = dto.email.trim().toLowerCase();
    const invalido = new BadRequestException('A verificação do e-mail expirou. Verifique o e-mail novamente.');
    const t = (await this.db.query('SELECT token_hash, (token_expira < now()) AS vencido FROM sistema.pin_cadastro WHERE email=$1 AND token_hash IS NOT NULL', [email])).rows[0];
    if (!t || t.vencido || t.token_hash !== createHash('sha256').update(dto.token).digest('hex')) throw invalido;
    if (!(await this.db.query('SELECT 1 FROM sistema.cidades WHERE id=$1', [dto.cidade_id])).rowCount) throw new BadRequestException('Cidade inválida.');
    const nome = `${dto.nome.trim()} ${dto.sobrenome.trim()}`.replace(/\s+/g, ' ');
    let id: number;
    try {
      id = (await this.db.query(
        "INSERT INTO sistema.users (nome,email,password_hash,role,matricula,cidade_id,autorizado,origem) VALUES ($1,$2,$3,'ALUNO',$4,$5,true,'senha') RETURNING id",
        [nome, email, await bcrypt.hash(dto.senha, 10), dto.matricula.trim(), dto.cidade_id],
      )).rows[0].id;
    } catch (e) {
      const c = e as { code?: string; constraint?: string };
      if (c.code === '23505') throw new ConflictException(c.constraint === 'users_matricula_uq' ? 'Esta matrícula já está em uso por outro aluno.' : 'Este e-mail já possui cadastro.');
      throw e;
    }
    await this.db.query('DELETE FROM sistema.pin_cadastro WHERE email=$1', [email]);
    this.aud.registrar('cadastro', { ator: id, email, req, detalhe: { matricula: dto.matricula.trim(), cidade_id: dto.cidade_id } });
    if (dto.lat != null && dto.lng != null) {
      await this.db.query('UPDATE sistema.users SET ultimo_acesso=now() WHERE id=$1', [id]);
      const csrf = await this.iniciarSessao(res, id, { lat: dto.lat, lng: dto.lng });
      return { role: 'ALUNO', logado: true, csrf };
    }
    return { role: 'ALUNO', logado: false };
  }

  /** Passo 1 da recuperação: envia um PIN de 4 dígitos ao e-mail cadastrado; e-mail desconhecido recebe um aviso claro. */
  @Post('senha/solicitar')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  async solicitarSenha(@Body() dto: EmailDto) {
    const r = await this.db.query('SELECT id, nome FROM sistema.users WHERE lower(email)=lower($1)', [dto.email.trim()]);
    const u = r.rows[0];
    if (!u) throw new NotFoundException('Este e-mail não está cadastrado. Confira o endereço digitado ou procure a administração do Instituto.');
    const ult = (await this.db.query('SELECT EXTRACT(EPOCH FROM (now()-enviado_em))::int AS seg FROM sistema.pin_senha WHERE user_id=$1', [u.id])).rows[0];
    if (ult && ult.seg < PIN_INTERVALO_S) throw new HttpException(`Aguarde ${PIN_INTERVALO_S - ult.seg}s para pedir um novo código.`, 429);
    const pin = String(randomInt(0, 10000)).padStart(4, '0');
    await this.db.query(
      `INSERT INTO sistema.pin_senha (user_id, pin_hash, expira, tentativas, enviado_em, reset_hash, reset_expira) VALUES ($1,$2, now() + interval '10 minutes', 0, now(), NULL, NULL)
       ON CONFLICT (user_id) DO UPDATE SET pin_hash=EXCLUDED.pin_hash, expira=EXCLUDED.expira, tentativas=0, enviado_em=now(), reset_hash=NULL, reset_expira=NULL`,
      [u.id, this.hashPin(u.id, pin)],
    );
    await this.mail.enviarPin(dto.email.trim(), u.nome, pin, await fotoDoUsuario(this.db, this.storage, u.id), 'senha');
    return { ok: true };
  }

  /** Passo 2: confere o PIN (10 min, 5 tentativas) e devolve um token de uso único para definir a nova senha. */
  @Post('senha/confirmar')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  async confirmarSenha(@Body() dto: ConfirmarSenhaDto) {
    const erro = new BadRequestException('Código incorreto ou expirado. Peça um novo código.');
    const u = (await this.db.query('SELECT id FROM sistema.users WHERE lower(email)=lower($1)', [dto.email.trim()])).rows[0];
    if (!u) throw erro;
    const r = (await this.db.query('SELECT pin_hash, tentativas, (expira < now()) AS vencido FROM sistema.pin_senha WHERE user_id=$1 AND pin_hash IS NOT NULL', [u.id])).rows[0];
    if (!r || r.vencido || r.tentativas >= PIN_TENTATIVAS) {
      await this.db.query('DELETE FROM sistema.pin_senha WHERE user_id=$1', [u.id]);
      throw erro;
    }
    if (this.hashPin(u.id, dto.pin) !== r.pin_hash) {
      await this.db.query('UPDATE sistema.pin_senha SET tentativas = tentativas + 1 WHERE user_id=$1', [u.id]);
      throw new BadRequestException(`Código incorreto. Restam ${PIN_TENTATIVAS - r.tentativas - 1} tentativa(s).`);
    }
    const token = randomBytes(32).toString('hex');
    await this.db.query("UPDATE sistema.pin_senha SET pin_hash=NULL, reset_hash=$2, reset_expira = now() + interval '10 minutes' WHERE user_id=$1", [u.id, createHash('sha256').update(token).digest('hex')]);
    return { token };
  }

  /** Passo 3: com o token do passo 2, grava a nova senha (hash seguro). O token só vale uma vez. */
  @Post('senha/redefinir')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  async redefinirSenha(@Body() dto: RedefinirDto, @Req() req: Request) {
    const erro = new BadRequestException('Sessão de recuperação expirada. Comece novamente.');
    const u = (await this.db.query('SELECT id FROM sistema.users WHERE lower(email)=lower($1)', [dto.email.trim()])).rows[0];
    if (!u) throw erro;
    const r = (await this.db.query('SELECT reset_hash, (reset_expira < now()) AS vencido FROM sistema.pin_senha WHERE user_id=$1 AND reset_hash IS NOT NULL', [u.id])).rows[0];
    if (!r || r.vencido || r.reset_hash !== createHash('sha256').update(dto.token).digest('hex')) throw erro;
    await this.db.query('UPDATE sistema.users SET password_hash=$2 WHERE id=$1', [u.id, await bcrypt.hash(dto.senha, 10)]);
    await this.db.query('DELETE FROM sistema.pin_senha WHERE user_id=$1', [u.id]);
    await this.sessao.revogarTodas(u.id);
    tentativas.delete(dto.email.trim().toLowerCase());
    this.aud.registrar('senha_redefinida', { ator: u.id, email: dto.email.trim(), req });
    return { ok: true };
  }

  /** Cidade da sessão = cidade cadastrada mais próxima da localização informada no login (até 150 km). Não pode ser trocada depois. */
  private async cidadeDaPosicao(lat: number, lng: number): Promise<number | null> {
    const r = await this.db.query('SELECT id, lat, lng FROM sistema.cidades WHERE lat IS NOT NULL AND lng IS NOT NULL');
    const rad = (x: number) => (x * Math.PI) / 180;
    const dist = (c: { lat: number; lng: number }) => {
      const h = Math.sin(rad(c.lat - lat) / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(c.lat)) * Math.sin(rad(c.lng - lng) / 2) ** 2;
      return 12742 * Math.asin(Math.sqrt(h));
    };
    const melhor = r.rows.map((c) => ({ id: c.id as number, d: dist(c) })).sort((a, b) => a.d - b.d)[0];
    return melhor && melhor.d <= 150 ? melhor.id : null;
  }

  private async iniciarSessao(res: Response, userId: number, pos: { lat: number; lng: number; lembrar?: boolean }) {
    const cid = await this.cidadeDaPosicao(pos.lat, pos.lng);
    return this.sessao.criar(res, userId, cid, !!pos.lembrar);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response, @Req() req: Request) {
    const k = dto.email.toLowerCase();
    const t = tentativas.get(k);
    if (t && t.n >= 8 && t.ate > Date.now()) throw new UnauthorizedException('Muitas tentativas. Aguarde alguns minutos.');
    const r = await this.db.query('SELECT id,role,password_hash FROM sistema.users WHERE lower(email)=lower($1)', [dto.email]);
    const ok = r.rows[0] && (await bcrypt.compare(dto.senha, r.rows[0].password_hash));
    if (!ok) {
      this.aud.registrar('login_falha', { ator: r.rows[0]?.id ?? null, email: dto.email, req, detalhe: { motivo: r.rows[0] ? 'senha incorreta' : 'e-mail não cadastrado' } });
      tentativas.set(k, { n: (t && t.ate > Date.now() ? t.n : 0) + 1, ate: Date.now() + 5 * 60_000 });
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    tentativas.delete(k);
    await this.db.query('UPDATE sistema.users SET ultimo_acesso=now() WHERE id=$1', [r.rows[0].id]);
    const csrf = await this.iniciarSessao(res, r.rows[0].id, dto);
    this.aud.registrar('login', { ator: r.rows[0].id, email: dto.email, req, detalhe: { metodo: 'senha', lembrar: !!dto.lembrar } });
    return { role: r.rows[0].role, csrf };
  }

  /** ATALHO DE DESENVOLVIMENTO: só existe com DEV_LOGIN=1 (nunca definido no Docker/produção) e só aceita chamadas da própria máquina. */
  @Post('dev-login')
  @HttpCode(200)
  async devLogin(@Body() dto: { perfil?: string }, @Res({ passthrough: true }) res: Response, @Req() req: Request) {
    const local = /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress ?? '');
    if (process.env.DEV_LOGIN !== '1' || !local) throw new NotFoundException();
    const role = dto?.perfil === 'ADMIN' ? 'ADMIN' : 'ALUNO';
    const r = await this.db.query("SELECT id,role,cidade_id FROM sistema.users WHERE role=$1 ORDER BY (email LIKE 'aluno.acesso%') DESC, id LIMIT 1", [role]);
    if (!r.rows[0]) throw new NotFoundException('Sem usuário desse perfil.');
    const csrf = await this.sessao.criar(res, r.rows[0].id, r.rows[0].cidade_id ?? null, true);
    return { role: r.rows[0].role, csrf };
  }

  /** Login com Google: o ID token do Firebase é validado no servidor. E-mail novo entra como ALUNO com nome e foto do Google
   *  e matrícula vazia (primeiro acesso): precisa informar a matrícula antes de enviar fotos. */
  @Post('google')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  async google(@Body() dto: GoogleDto, @Res({ passthrough: true }) res: Response, @Req() req: Request) {
    const { email, nome, foto } = await this.firebase.emailGoogle(dto.idToken);
    let r = await this.db.query('SELECT id,role FROM sistema.users WHERE lower(email)=lower($1) OR lower(google_email)=lower($1)', [email]);
    if (!r.rows[0]) {
      // senha aleatória e inutilizável: quem entra pelo Google não tem login por senha
      const hash = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
      r = await this.db.query(
        "INSERT INTO sistema.users (nome,email,google_email,password_hash,role,autorizado,origem,foto_url) VALUES ($1,$2,$2,$3,'ALUNO',true,'google',$4) RETURNING id,role",
        [nome, email, hash, foto],
      );
    } else if (foto) {
      await this.db.query('UPDATE sistema.users SET foto_url=$2 WHERE id=$1 AND foto_key IS NULL AND foto_url IS DISTINCT FROM $2', [r.rows[0].id, foto]);
    }
    await this.db.query('UPDATE sistema.users SET ultimo_acesso=now() WHERE id=$1', [r.rows[0].id]);
    const csrf = await this.iniciarSessao(res, r.rows[0].id, dto);
    this.aud.registrar('login', { ator: r.rows[0].id, email, req, detalhe: { metodo: 'google' } });
    return { role: r.rows[0].role, csrf };
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return { csrf: await this.sessao.renovar(req, res) };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const quem = await this.sessao.encerrar(req, res);
    if (quem) this.aud.registrar('logout', { ator: quem, req });
  }

  @Get('me')
  @AllowPendente()
  @UseGuards(AuthGuard)
  me(@Me() u: SessionUser, @Req() req: Request & { sid?: string }) {
    return { ...u, csrf: this.sessao.csrfDe(req.sid ?? '') };
  }
}
