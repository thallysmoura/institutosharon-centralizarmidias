import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { DbService } from '../db/db.service';
import { COOKIE } from '../common/auth';

export const COOKIE_REFRESH = 'sharon_refresh';
const ACESSO = '15m'; // vida curta do token de acesso
const DIAS_LEMBRAR = 30;
const DIAS_SESSAO = 1;
const sha = (t: string) => createHash('sha256').update(t).digest('hex');

/**
 * Sessão com token de acesso curto (JWT, 15 min, cookie httpOnly) + refresh token opaco, de uso único e com rotação
 * (guardado só como hash no banco; reutilizar um refresh já usado derruba toda a família de sessões).
 * O token CSRF é derivado por HMAC do id da sessão (`sid`) e enviado ao front no corpo das respostas.
 */
@Injectable()
export class SessaoService {
  constructor(private readonly cfg: ConfigService, private readonly db: DbService) {}

  /** Caminho do cookie de renovação; muda só se a API for servida sob um prefixo (ex.: proxy /backend). */
  private get pathRefresh() { return this.cfg.get<string>('COOKIE_REFRESH_PATH', '/auth'); }
  private get segredo() { return this.cfg.getOrThrow<string>('JWT_SECRET'); }
  private opcoes(path: string, lembrar: boolean): CookieOptions {
    return { httpOnly: true, sameSite: 'lax', secure: this.cfg.get('COOKIE_SECURE') === 'true', path, ...(lembrar ? { maxAge: DIAS_LEMBRAR * 864e5 } : {}) };
  }

  csrfDe(sid: string) { return createHmac('sha256', this.segredo).update(`csrf:${sid}`).digest('hex'); }

  private emitirAcesso(res: Response, userId: number, cid: number | null, lembrar: boolean) {
    const sid = randomBytes(16).toString('hex');
    const token = jwt.sign({ sub: String(userId), sid, ...(cid ? { cid } : {}) }, this.segredo, { expiresIn: ACESSO });
    res.cookie(COOKIE, token, this.opcoes('/', lembrar));
    return this.csrfDe(sid);
  }

  private async emitirRefresh(res: Response, req: Request | undefined, userId: number, cid: number | null, lembrar: boolean, familia: string) {
    const token = randomBytes(48).toString('base64url');
    const dias = lembrar ? DIAS_LEMBRAR : DIAS_SESSAO;
    await this.db.query(
      `INSERT INTO sistema.refresh_tokens (user_id, token_hash, familia, cid, lembrar, expira, ip, ua) VALUES ($1,$2,$3,$4,$5, now() + ($6 || ' days')::interval, $7, $8)`,
      [userId, sha(token), familia, cid, lembrar, String(dias), req?.ip ?? null, String(req?.headers['user-agent'] ?? '').slice(0, 200)],
    );
    res.cookie(COOKIE_REFRESH, token, this.opcoes(this.pathRefresh, lembrar));
  }

  /** Abre uma sessão nova (login/cadastro/Google). Devolve o token CSRF. */
  async criar(res: Response, userId: number, cid: number | null, lembrar: boolean) {
    const req = res.req;
    await this.db.query('DELETE FROM sistema.refresh_tokens WHERE expira < now() - interval \'7 days\'');
    await this.emitirRefresh(res, req, userId, cid, lembrar, randomUUID());
    return this.emitirAcesso(res, userId, cid, lembrar);
  }

  /** Troca o refresh token por um novo par de tokens (rotação). Reuso de um token já consumido revoga a família inteira. */
  async renovar(req: Request, res: Response) {
    const atual: string | undefined = req.cookies?.[COOKIE_REFRESH];
    const nega = () => { this.limpar(res); return new UnauthorizedException('Sessão expirada. Entre novamente.'); };
    if (!atual) throw nega();
    const r = (await this.db.query('SELECT id, user_id, familia, cid, lembrar, revogado, (expira < now()) AS vencido FROM sistema.refresh_tokens WHERE token_hash=$1', [sha(atual)])).rows[0];
    if (!r) throw nega();
    if (r.revogado) {
      await this.db.query('UPDATE sistema.refresh_tokens SET revogado=true WHERE familia=$1', [r.familia]); // reuso: possível roubo
      throw nega();
    }
    if (r.vencido) throw nega();
    if (!(await this.db.query('SELECT 1 FROM sistema.users WHERE id=$1', [r.user_id])).rowCount) throw nega();
    await this.db.query('UPDATE sistema.refresh_tokens SET revogado=true WHERE id=$1', [r.id]);
    await this.emitirRefresh(res, req, r.user_id, r.cid, r.lembrar, r.familia);
    return this.emitirAcesso(res, r.user_id, r.cid, r.lembrar);
  }

  /** Encerra a sessão: revoga a família do refresh token atual e limpa os cookies. */
  async encerrar(req: Request, res: Response): Promise<number | null> {
    const atual: string | undefined = req.cookies?.[COOKIE_REFRESH];
    const dono = atual ? (await this.db.query('SELECT user_id FROM sistema.refresh_tokens WHERE token_hash=$1', [sha(atual)])).rows[0]?.user_id ?? null : null;
    if (atual) await this.db.query('UPDATE sistema.refresh_tokens SET revogado=true WHERE familia=(SELECT familia FROM sistema.refresh_tokens WHERE token_hash=$1)', [sha(atual)]);
    this.limpar(res);
    return dono;
  }

  /** Revoga todas as sessões do usuário (ex.: após trocar a senha). */
  revogarTodas(userId: number) {
    return this.db.query('UPDATE sistema.refresh_tokens SET revogado=true WHERE user_id=$1', [userId]);
  }

  private limpar(res: Response) {
    res.clearCookie(COOKIE, { path: '/' });
    res.clearCookie(COOKIE_REFRESH, { path: this.pathRefresh });
  }
}
