import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { DbService } from '../db/db.service';

export const COOKIE = 'sharon_session';
export type SessionUser = {
  id: number;
  nome: string;
  email: string;
  role: 'ADMIN' | 'ALUNO';
  matricula: string | null;
  cidade_id: number | null;
  cidade: string | null;
  foto_url: string | null;
  primeiro_acesso: boolean;
};

export const Roles = (...roles: SessionUser['role'][]) => SetMetadata('roles', roles);
/** Rotas liberadas ao aluno que ainda não informou a matrícula (primeiro acesso): ver o perfil, informar a matrícula e a foto. */
export const AllowPendente = () => SetMetadata('pendenteOk', true);
export const Me = createParamDecorator((_: unknown, ctx: ExecutionContext): SessionUser => ctx.switchToHttp().getRequest().user);

/** Autentica pelo cookie JWT, recarrega o usuário do banco (perfil/cidade sempre do PostgreSQL) e valida o papel exigido pela rota. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly cfg: ConfigService, private readonly db: DbService, private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const token = req.cookies?.[COOKIE];
    if (!token) throw new UnauthorizedException();
    let sub: number;
    let cid: number | null = null;
    try {
      const p = jwt.verify(token, this.cfg.getOrThrow<string>('JWT_SECRET')) as jwt.JwtPayload;
      sub = Number(p.sub);
      cid = typeof p.cid === 'number' ? p.cid : null;
    } catch {
      throw new UnauthorizedException();
    }
    const r = await this.db.query<SessionUser>(
      `SELECT u.id,u.nome,u.email,u.role,u.matricula,COALESCE($2::int, u.cidade_id) AS cidade_id,c.nome AS cidade,CASE WHEN u.foto_key IS NOT NULL OR u.foto_url IS NOT NULL THEN '/users/' || u.id || '/foto?v=' || u.foto_v END AS foto_url,(u.role='ALUNO' AND COALESCE(u.matricula,'')='') AS primeiro_acesso FROM sistema.users u LEFT JOIN sistema.cidades c ON c.id=COALESCE($2::int, u.cidade_id) WHERE u.id=$1`,
      [sub, cid],
    );
    if (!r.rows[0]) throw new UnauthorizedException();
    req.user = r.rows[0];
    const roles = this.reflector.get<string[]>('roles', ctx.getHandler()) ?? this.reflector.get<string[]>('roles', ctx.getClass());
    if (roles?.length && !roles.includes(req.user.role)) throw new ForbiddenException();
    if (req.user.primeiro_acesso && !this.reflector.get<boolean>('pendenteOk', ctx.getHandler()))
      throw new ForbiddenException('Complete o seu perfil informando a matrícula para continuar.');
    return true;
  }
}
