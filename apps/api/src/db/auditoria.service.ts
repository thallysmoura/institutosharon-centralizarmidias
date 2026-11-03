import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { DbService } from './db.service';

type Dados = { ator?: number | null; email?: string; foto?: number | null; atendimento?: number | null; detalhe?: Record<string, unknown>; req?: Request };

/** Trilha de auditoria: registra quem fez o quê, quando e de onde. Nunca derruba a ação principal se o registro falhar. */
@Injectable()
export class AuditoriaService {
  private readonly log = new Logger('Auditoria');
  constructor(private readonly db: DbService) {}

  async registrar(acao: string, d: Dados = {}) {
    try {
      const ua = d.req?.headers['user-agent'];
      await this.db.query(
        'INSERT INTO sistema.auditoria (ator_id, ator_email, acao, foto_id, atendimento_id, detalhe, ip, user_agent) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [d.ator ?? null, d.email?.slice(0, 160) ?? null, acao, d.foto ?? null, d.atendimento ?? null, d.detalhe ?? null, d.req?.ip ?? null, typeof ua === 'string' ? ua.slice(0, 300) : null],
      );
    } catch (e) {
      this.log.warn(`Falha ao registrar "${acao}": ${(e as Error).message}`);
    }
  }
}
