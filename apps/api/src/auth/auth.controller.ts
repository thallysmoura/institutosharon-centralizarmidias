import { Body, Controller, Get, HttpCode, Post, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsEmail, IsNumber, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { Response } from 'express';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { DbService } from '../db/db.service';
import { randomBytes } from 'node:crypto';
import { AllowPendente, AuthGuard, COOKIE, Me, SessionUser } from '../common/auth';
import { FirebaseService } from './firebase.service';

/** A localização é pré-requisito do login: sem coordenadas a API recusa (o navegador só as envia com a permissão concedida). */
class Posicao {
  @IsNumber() @Min(-90) @Max(90) lat!: number;
  @IsNumber() @Min(-180) @Max(180) lng!: number;
}

class LoginDto extends Posicao {
  @IsEmail() @MaxLength(160) email!: string;
  @IsString() @MinLength(4) @MaxLength(100) senha!: string;
}

class GoogleDto extends Posicao {
  @IsString() @MinLength(20) @MaxLength(4096) idToken!: string;
}

const tentativas = new Map<string, { n: number; ate: number }>();

@Controller('auth')
export class AuthController {
  constructor(private readonly db: DbService, private readonly cfg: ConfigService, private readonly firebase: FirebaseService) {}

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

  private async iniciarSessao(res: Response, userId: number, pos: Posicao) {
    const cid = await this.cidadeDaPosicao(pos.lat, pos.lng);
    const token = jwt.sign({ sub: String(userId), ...(cid ? { cid } : {}) }, this.cfg.getOrThrow<string>('JWT_SECRET'), { expiresIn: '7d' });
    res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: this.cfg.get('COOKIE_SECURE') === 'true', maxAge: 7 * 864e5, path: '/' });
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const k = dto.email.toLowerCase();
    const t = tentativas.get(k);
    if (t && t.n >= 8 && t.ate > Date.now()) throw new UnauthorizedException('Muitas tentativas. Aguarde alguns minutos.');
    const r = await this.db.query('SELECT id,role,password_hash FROM sistema.users WHERE lower(email)=lower($1)', [dto.email]);
    const ok = r.rows[0] && (await bcrypt.compare(dto.senha, r.rows[0].password_hash));
    if (!ok) {
      tentativas.set(k, { n: (t && t.ate > Date.now() ? t.n : 0) + 1, ate: Date.now() + 5 * 60_000 });
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    tentativas.delete(k);
    await this.db.query('UPDATE sistema.users SET ultimo_acesso=now() WHERE id=$1', [r.rows[0].id]);
    await this.iniciarSessao(res, r.rows[0].id, dto);
    return { role: r.rows[0].role };
  }

  /** Login com Google: o ID token do Firebase é validado no servidor. E-mail novo entra como ALUNO sem autorização
   *  (matrícula vazia) e aparece no Controle de Acesso; só envia fotos depois que a administração libera. */
  @Post('google')
  @HttpCode(200)
  async google(@Body() dto: GoogleDto, @Res({ passthrough: true }) res: Response) {
    const { email, nome, foto } = await this.firebase.emailGoogle(dto.idToken);
    let r = await this.db.query('SELECT id,role FROM sistema.users WHERE lower(email)=lower($1)', [email]);
    if (!r.rows[0]) {
      // senha aleatória e inutilizável: quem entra pelo Google não tem login por senha
      const hash = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
      r = await this.db.query(
        "INSERT INTO sistema.users (nome,email,password_hash,role,autorizado,origem,foto_url) VALUES ($1,$2,$3,'ALUNO',false,'google',$4) RETURNING id,role",
        [nome, email, hash, foto],
      );
    } else if (foto) {
      await this.db.query('UPDATE sistema.users SET foto_url=$2 WHERE id=$1 AND foto_url IS DISTINCT FROM $2', [r.rows[0].id, foto]);
    }
    await this.db.query('UPDATE sistema.users SET ultimo_acesso=now() WHERE id=$1', [r.rows[0].id]);
    await this.iniciarSessao(res, r.rows[0].id, dto);
    return { role: r.rows[0].role };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE, { path: '/' });
  }

  @Get('me')
  @AllowPendente()
  @UseGuards(AuthGuard)
  me(@Me() u: SessionUser) {
    return u;
  }
}
