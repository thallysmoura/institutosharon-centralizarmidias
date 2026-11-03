import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import type { Response } from 'express';

const MAX_CLIENTES = 50; // só administradores abrem o canal
const JANELA_MS = 800; // junta vários envios numa única mensagem

/**
 * Tempo real via Server-Sent Events: o servidor só avisa QUE houve novos envios (ids), em lotes de até 0,8 s;
 * o painel então busca apenas esses registros. Nada de polling e nenhum dado pesado trafega no canal.
 * Com mais de uma instância da API, trocar o emissor por LISTEN/NOTIFY do Postgres (mesma interface).
 */
@Injectable()
export class EventosService implements OnModuleDestroy {
  private readonly clientes = new Set<Response>();
  private pendentes = new Set<number>();
  private timer: NodeJS.Timeout | null = null;
  private readonly batida = setInterval(() => this.clientes.forEach((r) => r.write(': ping\n\n')), 25_000);

  constructor() {
    this.batida.unref();
  }

  registrar(res: Response): boolean {
    if (this.clientes.size >= MAX_CLIENTES) return false;
    this.clientes.add(res);
    res.on('close', () => this.clientes.delete(res));
    return true;
  }

  /** Avisa os painéis conectados; sem ninguém conectado não faz nada (custo zero). */
  novoAtendimento(id: number) {
    if (!this.clientes.size) return;
    this.pendentes.add(id);
    this.timer ??= setTimeout(() => this.descarregar(), JANELA_MS);
  }

  /** Exclusão feita por aluno: avisa na hora (evento raro, sem lote). */
  exclusao(dados: Record<string, unknown>) {
    if (!this.clientes.size) return;
    const msg = `event: exclusao\ndata: ${JSON.stringify(dados)}\n\n`;
    this.clientes.forEach((r) => r.write(msg));
  }

  private descarregar() {
    const ids = [...this.pendentes];
    this.pendentes = new Set();
    this.timer = null;
    const msg = `event: novos\ndata: ${JSON.stringify({ ids: ids.slice(-30), n: ids.length })}\n\n`;
    this.clientes.forEach((r) => r.write(msg));
  }

  onModuleDestroy() {
    clearInterval(this.batida);
    if (this.timer) clearTimeout(this.timer);
    this.clientes.forEach((r) => r.end());
  }
}

@Global()
@Module({ providers: [EventosService], exports: [EventosService] })
export class EventosModule {}
