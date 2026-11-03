import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Valida o ID token do Firebase (login com Google) usando a conta de serviço — a chave fica só no servidor, fora do repositório. */
@Injectable()
export class FirebaseService {
  private readonly log = new Logger('Firebase');
  private app?: App;

  constructor(private readonly cfg: ConfigService) {}

  private init() {
    if (this.app) return this.app;
    const path = this.cfg.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
    const json = this.cfg.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (!path && !json) throw new UnauthorizedException('Login com Google não configurado.');
    const conta = JSON.parse(json ?? readFileSync(resolve(path as string), 'utf8'));
    this.app = getApps()[0] ?? initializeApp({ credential: cert(conta) });
    this.log.log('Firebase Admin inicializado');
    return this.app;
  }

  /** Retorna o e-mail verificado do usuário Google ou lança 401. */
  async emailGoogle(idToken: string): Promise<{ email: string; nome: string; foto: string | null }> {
    try {
      const t = await getAuth(this.init()).verifyIdToken(idToken);
      if (!t.email || !t.email_verified || t.firebase?.sign_in_provider !== 'google.com') throw new Error('e-mail não verificado');
      return { email: t.email, nome: t.name ?? t.email, foto: t.picture ?? null };
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      this.log.warn(`Token Google recusado: ${(e as Error).message}`);
      throw new UnauthorizedException('Não foi possível validar o login com Google.');
    }
  }
}
