import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResultRow } from 'pg';
import * as bcrypt from 'bcryptjs';

const MIGRATION = `
CREATE SCHEMA IF NOT EXISTS sistema;
CREATE TABLE IF NOT EXISTS sistema.cidades (id SERIAL PRIMARY KEY, nome TEXT UNIQUE NOT NULL);
ALTER TABLE sistema.cidades ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE sistema.cidades ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
CREATE TABLE IF NOT EXISTS sistema.users (
  id SERIAL PRIMARY KEY, nome TEXT NOT NULL, email TEXT NOT NULL, password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN','ALUNO')), matricula TEXT,
  cidade_id INT REFERENCES sistema.cidades(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE sistema.users ADD COLUMN IF NOT EXISTS autorizado BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE sistema.users ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'senha';
ALTER TABLE sistema.users ADD COLUMN IF NOT EXISTS foto_url TEXT;
ALTER TABLE sistema.users ADD COLUMN IF NOT EXISTS foto_key TEXT;
ALTER TABLE sistema.users ADD COLUMN IF NOT EXISTS foto_v INT NOT NULL DEFAULT 0;
ALTER TABLE sistema.users ADD COLUMN IF NOT EXISTS google_email TEXT;
UPDATE sistema.users SET google_email = email WHERE origem='google' AND google_email IS NULL;
CREATE TABLE IF NOT EXISTS sistema.pin_senha (
  user_id INT PRIMARY KEY REFERENCES sistema.users(id) ON DELETE CASCADE, pin_hash TEXT, expira TIMESTAMPTZ, tentativas INT NOT NULL DEFAULT 0,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(), reset_hash TEXT, reset_expira TIMESTAMPTZ);
ALTER TABLE sistema.fotos ADD COLUMN IF NOT EXISTS dispositivo TEXT;
ALTER TABLE sistema.fotos ADD COLUMN IF NOT EXISTS so TEXT;
ALTER TABLE sistema.fotos ADD COLUMN IF NOT EXISTS navegador TEXT;
ALTER TABLE sistema.fotos ADD COLUMN IF NOT EXISTS oculta_em TIMESTAMPTZ;
ALTER TABLE sistema.fotos ADD COLUMN IF NOT EXISTS oculta_por INT;
CREATE INDEX IF NOT EXISTS fotos_atend_idx ON sistema.fotos (atendimento_id);
CREATE INDEX IF NOT EXISTS fotos_oculta_idx ON sistema.fotos (oculta_em) WHERE oculta_em IS NOT NULL;
CREATE TABLE IF NOT EXISTS sistema.auditoria (
  id BIGSERIAL PRIMARY KEY, quando TIMESTAMPTZ NOT NULL DEFAULT now(), ator_id INT, acao TEXT NOT NULL, foto_id INT, atendimento_id INT, detalhe JSONB);
ALTER TABLE sistema.auditoria ADD COLUMN IF NOT EXISTS ator_email TEXT;
ALTER TABLE sistema.auditoria ADD COLUMN IF NOT EXISTS ip TEXT;
ALTER TABLE sistema.auditoria ADD COLUMN IF NOT EXISTS user_agent TEXT;
CREATE INDEX IF NOT EXISTS auditoria_quando_idx ON sistema.auditoria (quando DESC);
CREATE INDEX IF NOT EXISTS auditoria_ator_idx ON sistema.auditoria (ator_id, quando DESC);
CREATE INDEX IF NOT EXISTS auditoria_acao_idx ON sistema.auditoria (acao, quando DESC);
CREATE TABLE IF NOT EXISTS sistema.avisos (
  id SERIAL PRIMARY KEY, titulo TEXT NOT NULL, corpo TEXT NOT NULL, para_todos BOOLEAN NOT NULL DEFAULT true,
  criado_por INT REFERENCES sistema.users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), editado_em TIMESTAMPTZ);
CREATE INDEX IF NOT EXISTS avisos_created_idx ON sistema.avisos (created_at DESC);
CREATE TABLE IF NOT EXISTS sistema.aviso_destinos (
  aviso_id INT NOT NULL REFERENCES sistema.avisos(id) ON DELETE CASCADE, user_id INT NOT NULL REFERENCES sistema.users(id) ON DELETE CASCADE, PRIMARY KEY (aviso_id, user_id));
CREATE TABLE IF NOT EXISTS sistema.aviso_leituras (
  aviso_id INT NOT NULL REFERENCES sistema.avisos(id) ON DELETE CASCADE, user_id INT NOT NULL REFERENCES sistema.users(id) ON DELETE CASCADE,
  lido_em TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (aviso_id, user_id));
ALTER TABLE sistema.avisos ADD COLUMN IF NOT EXISTS para_cidades INT[];
CREATE INDEX IF NOT EXISTS aviso_leituras_user_idx ON sistema.aviso_leituras (user_id);
CREATE INDEX IF NOT EXISTS users_cidade_idx ON sistema.users (cidade_id);
CREATE INDEX IF NOT EXISTS users_role_nome_idx ON sistema.users (role, nome, id);
CREATE INDEX IF NOT EXISTS users_role_criado_idx ON sistema.users (role, created_at DESC, id DESC);
CREATE TABLE IF NOT EXISTS sistema.aviso_anexos (
  id SERIAL PRIMARY KEY, aviso_id INT NOT NULL REFERENCES sistema.avisos(id) ON DELETE CASCADE, tipo TEXT NOT NULL, ordem INT NOT NULL DEFAULT 0,
  nome TEXT, mime TEXT, tamanho INT, chave TEXT, url TEXT, titulo TEXT, descricao TEXT, site TEXT);
CREATE INDEX IF NOT EXISTS aviso_anexos_aviso_idx ON sistema.aviso_anexos (aviso_id);
CREATE TABLE IF NOT EXISTS sistema.push_subs (
  id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES sistema.users(id) ON DELETE CASCADE, endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL, auth TEXT NOT NULL, ua TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS push_subs_user_idx ON sistema.push_subs (user_id);
CREATE TABLE IF NOT EXISTS sistema.refresh_tokens (
  id BIGSERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES sistema.users(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE,
  familia TEXT NOT NULL, cid INT, lembrar BOOLEAN NOT NULL DEFAULT false, expira TIMESTAMPTZ NOT NULL, revogado BOOLEAN NOT NULL DEFAULT false,
  criado TIMESTAMPTZ NOT NULL DEFAULT now(), ip TEXT, ua TEXT);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON sistema.refresh_tokens (user_id);
CREATE TABLE IF NOT EXISTS sistema.pin_cadastro (
  email TEXT PRIMARY KEY, pin_hash TEXT, expira TIMESTAMPTZ, tentativas INT NOT NULL DEFAULT 0,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(), token_hash TEXT, token_expira TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS sistema.pin_email (
  user_id INT PRIMARY KEY REFERENCES sistema.users(id) ON DELETE CASCADE, novo_email TEXT NOT NULL, pin_hash TEXT NOT NULL,
  expira TIMESTAMPTZ NOT NULL, tentativas INT NOT NULL DEFAULT 0, enviado_em TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE sistema.users ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS users_matricula_uq ON sistema.users (lower(matricula)) WHERE matricula IS NOT NULL AND matricula <> '';
CREATE UNIQUE INDEX IF NOT EXISTS users_email_uq ON sistema.users (lower(email));
CREATE TABLE IF NOT EXISTS sistema.atendimentos (
  id SERIAL PRIMARY KEY, identificador_paciente TEXT NOT NULL,
  aluno_id INT NOT NULL REFERENCES sistema.users(id), cidade_id INT NOT NULL REFERENCES sistema.cidades(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE sistema.fotos ADD COLUMN IF NOT EXISTS bytes INT NOT NULL DEFAULT 0;
ALTER TABLE sistema.fotos ADD COLUMN IF NOT EXISTS thumb_key TEXT;
ALTER TABLE sistema.fotos ADD COLUMN IF NOT EXISTS thumb_bytes INT NOT NULL DEFAULT 0;
ALTER TABLE sistema.fotos ADD COLUMN IF NOT EXISTS width INT;
ALTER TABLE sistema.fotos ADD COLUMN IF NOT EXISTS height INT;
CREATE TABLE IF NOT EXISTS sistema.r2_uso (mes TEXT PRIMARY KEY, classe_a INT NOT NULL DEFAULT 0, classe_b INT NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS atend_aluno_idx ON sistema.atendimentos (aluno_id, created_at DESC);
CREATE INDEX IF NOT EXISTS atend_recentes_idx ON sistema.atendimentos (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS atend_cidade_idx ON sistema.atendimentos (cidade_id, created_at DESC);
CREATE TABLE IF NOT EXISTS sistema.fotos (
  id SERIAL PRIMARY KEY, atendimento_id INT NOT NULL REFERENCES sistema.atendimentos(id) ON DELETE CASCADE,
  storage_key TEXT UNIQUE NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
`;

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Db');
  readonly pool: Pool;

  constructor(private readonly cfg: ConfigService) {
    this.pool = new Pool({ connectionString: cfg.getOrThrow('DATABASE_URL'), options: '-c search_path=sistema,public', max: 10 });
  }

  query<T extends QueryResultRow = any>(text: string, params: unknown[] = []) {
    return this.pool.query<T>(text, params);
  }

  async onModuleInit() {
    await this.pool.query(MIGRATION);
    await this.pool.query('UPDATE sistema.users SET autorizado=true WHERE NOT autorizado'); // não há mais fila de autorização
    for (const [n, lat, lng] of [['Manaus', -3.119, -60.0217], ['Porto Velho', -8.7612, -63.9004], ['São Paulo', -23.5505, -46.6333]] as const)
      await this.pool.query('INSERT INTO sistema.cidades (nome,lat,lng) VALUES ($1,$2,$3) ON CONFLICT (nome) DO UPDATE SET lat=EXCLUDED.lat, lng=EXCLUDED.lng', [n, lat, lng]);
    await this.pool.query(
      "DELETE FROM sistema.cidades c WHERE c.nome='Fortaleza' AND NOT EXISTS (SELECT 1 FROM sistema.users u WHERE u.cidade_id=c.id) AND NOT EXISTS (SELECT 1 FROM sistema.atendimentos a WHERE a.cidade_id=c.id)",
    );
    const cidade = async (n: string) => (await this.pool.query('SELECT id FROM sistema.cidades WHERE nome=$1', [n])).rows[0].id;
    const seed = async (nome: string, email: string, senha: string, role: string, matricula: string | null, cidadeNome: string | null) => {
      const hash = await bcrypt.hash(senha, 10);
      await this.pool.query(
        'INSERT INTO sistema.users (nome,email,password_hash,role,matricula,cidade_id) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (lower(email)) DO NOTHING',
        [nome, email, hash, role, matricula, cidadeNome ? await cidade(cidadeNome) : null],
      );
    };
    await seed('Administração Sharon', this.cfg.getOrThrow('ADMIN_EMAIL'), this.cfg.getOrThrow('ADMIN_PASSWORD'), 'ADMIN', null, null);
    if (this.cfg.get('SEED_DEMO', 'false') === 'true') {
      await seed('Ana Beatriz (aluna teste)', 'aluno@institutosharon.local', 'Aluno@2026', 'ALUNO', 'A0001', 'Manaus');
      await seed('Maria Souza (aluna teste)', 'aluno2@institutosharon.local', 'Aluno@2026', 'ALUNO', 'A0002', 'Porto Velho');
    }
    this.log.log('Schema "sistema" pronto');
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
