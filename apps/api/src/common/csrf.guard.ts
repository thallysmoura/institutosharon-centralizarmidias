import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { COOKIE } from './auth';

const LEITURA = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Proteção CSRF em duas camadas para toda requisição que altera estado:
 * 1) `Origin` (quando enviado pelo navegador) precisa estar na lista de origens permitidas;
 * 2) com sessão ativa, o cabeçalho `X-CSRF-Token` precisa bater com o HMAC do id da sessão.
 * Rotas `/auth/*` (login, cadastro, recuperação, refresh, logout) são anteriores à sessão e só passam pela checagem de origem.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly origens: string[];
  constructor(private readonly cfg: ConfigService) {
    this.origens = cfg.get<string>('CORS_ORIGINS', 'http://localhost:3000').split(',').map((o) => o.trim());
  }

  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    if (LEITURA.has(req.method)) return true;
    const origem = req.headers.origin as string | undefined;
    if (origem && !this.origens.includes(origem)) throw new ForbiddenException('Origem não permitida.');
    if (String(req.path).startsWith('/auth/')) return true;
    const token = req.cookies?.[COOKIE];
    if (!token) return true; // sem sessão: o AuthGuard responde 401
    let sid: string;
    try {
      sid = String((jwt.verify(token, this.cfg.getOrThrow<string>('JWT_SECRET')) as jwt.JwtPayload).sid ?? '');
    } catch {
      return true; // token expirado/ inválido: o AuthGuard responde 401 e o front renova a sessão
    }
    const esperado = createHmac('sha256', this.cfg.getOrThrow<string>('JWT_SECRET')).update(`csrf:${sid}`).digest('hex');
    const enviado = String(req.headers['x-csrf-token'] ?? '');
    const a = Buffer.from(esperado);
    const b = Buffer.from(enviado);
    if (!sid || a.length !== b.length || !timingSafeEqual(a, b)) throw new ForbiddenException('Sessão inválida (CSRF). Recarregue a página e tente novamente.');
    return true;
  }
}
