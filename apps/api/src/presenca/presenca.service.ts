import { Body, Controller, Delete, Global, HttpCode, Injectable, Module, Post, Req, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import type { Request } from 'express';
import { AllowPendente, AuthGuard, Me, SessionUser } from '../common/auth';
import { DbService } from '../db/db.service';

export type Estado = 'online' | 'ausente' | 'offline';
type Registro = { ts: number; estado: 'ativo' | 'ausente'; dispositivo: string; so: string; navegador: string; ip: string; gravadoEm: number };

const ONLINE_MS = 90_000; // batida a cada ~40 s: até 90 s sem batida ainda conta como conectado
const AUSENTE_MS = 10 * 60_000; // sem batida de 90 s a 10 min: ausente; depois, offline
const GRAVA_DB_MS = 5 * 60_000; // grava "último acesso" no banco no máximo a cada 5 min por usuário
const GUARDA_MS = 24 * 3600_000;

/** Interpreta o User-Agent (sem dependências): tipo de aparelho, sistema e navegador. */
export function dispositivoDe(ua: string) {
  const tablet = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const celular = !tablet && /Mobi|iPhone|iPod|Android/i.test(ua);
  const so = /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Android/i.test(ua) ? 'Android' : /Windows/i.test(ua) ? 'Windows' : /Mac OS X|Macintosh/i.test(ua) ? 'macOS' : /CrOS/i.test(ua) ? 'ChromeOS' : /Linux/i.test(ua) ? 'Linux' : 'Outro';
  const navegador = /Edg\//i.test(ua) ? 'Edge' : /OPR\/|Opera/i.test(ua) ? 'Opera' : /SamsungBrowser/i.test(ua) ? 'Samsung' : /Firefox\/|FxiOS/i.test(ua) ? 'Firefox' : /Chrome\/|CriOS/i.test(ua) ? 'Chrome' : /Safari\//i.test(ua) ? 'Safari' : 'Outro';
  return { dispositivo: tablet ? 'Tablet' : celular ? 'Celular' : 'Computador', so, navegador };
}

/**
 * Presença em memória (barata e rápida): cada aba aberta envia uma batida leve a cada ~40 s com o estado (ativo/ausente).
 * Com mais de uma instância da API, mover o mapa para Redis (mesma interface).
 */
@Injectable()
export class PresencaService {
  private readonly mapa = new Map<number, Registro>();
  constructor(private readonly db: DbService) {
    setInterval(() => {
      const limite = Date.now() - GUARDA_MS;
      for (const [id, r] of this.mapa) if (r.ts < limite) this.mapa.delete(id);
    }, 10 * 60_000).unref();
  }

  batida(id: number, estado: 'ativo' | 'ausente', req: Request) {
    const agora = Date.now();
    const ant = this.mapa.get(id);
    const d = dispositivoDe(String(req.headers['user-agent'] ?? ''));
    let gravadoEm = ant?.gravadoEm ?? 0;
    if (agora - gravadoEm > GRAVA_DB_MS) {
      gravadoEm = agora;
      this.db.query('UPDATE sistema.users SET ultimo_acesso=now() WHERE id=$1', [id]).catch(() => null);
    }
    this.mapa.set(id, { ts: agora, estado, ...d, ip: req.ip ?? '', gravadoEm });
  }

  sair(id: number) {
    const r = this.mapa.get(id);
    if (r) r.ts = 0; // mantém o último aparelho, mas passa a offline
  }

  estadoDe(r: Registro): Estado {
    const idade = Date.now() - r.ts;
    if (idade <= ONLINE_MS) return r.estado === 'ativo' ? 'online' : 'ausente';
    return idade <= AUSENTE_MS ? 'ausente' : 'offline';
  }

  /** Só quem já enviou batida; os demais usuários são offline. */
  todos() {
    return [...this.mapa.entries()].map(([id, r]) => ({
      id,
      estado: this.estadoDe(r),
      visto_em: r.ts ? new Date(r.ts).toISOString() : null,
      dispositivo: r.dispositivo,
      so: r.so,
      navegador: r.navegador,
      ip: r.ip,
    }));
  }
}

class BatidaDto {
  @IsIn(['ativo', 'ausente']) estado!: 'ativo' | 'ausente';
}

@Controller('presenca')
@UseGuards(AuthGuard)
export class PresencaController {
  constructor(private readonly presenca: PresencaService) {}

  @Post()
  @AllowPendente()
  @HttpCode(204)
  batida(@Me() u: SessionUser, @Body() dto: BatidaDto, @Req() req: Request) {
    this.presenca.batida(u.id, dto.estado, req);
  }

  @Delete()
  @AllowPendente()
  @HttpCode(204)
  sair(@Me() u: SessionUser) {
    this.presenca.sair(u.id);
  }
}

@Global()
@Module({ controllers: [PresencaController], providers: [PresencaService], exports: [PresencaService] })
export class PresencaModule {}
