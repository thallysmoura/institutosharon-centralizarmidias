# Banco de dados e backup

Postgres 16, schema `sistema` (container `sharon-db`, porta 5433). As tabelas sao criadas e migradas sozinhas pela API ao subir (`apps/api/src/db/db.service.ts`).

## Arquivos
- `schema.sql`: estrutura completa (tabelas, indices, chaves). Sem dados. Versionado no Git.
- `../backups/*.dump`: estrutura + dados (formato custom do pg_dump). Contem dados pessoais: fica so na maquina, nunca no Git.

## Gerar backup

    bash scripts/backup-db.sh

## Restaurar
Estrutura em banco vazio:

    docker exec -i sharon-db psql -U sharon -d sharon < database/schema.sql

Estrutura + dados a partir de um `.dump`:

    docker exec -i sharon-db pg_restore -U sharon -d sharon --clean --if-exists --no-owner < backups/ARQUIVO.dump

## O que mais precisa de backup (fora do Git)
1. **Fotos**: bucket de armazenamento na nuvem (as imagens nao estao no banco). Ativar versionamento/replicacao do bucket ou copiar periodicamente.
2. **Segredos**: `apps/api/.env` (JWT_SECRET, chaves do armazenamento, SMTP, admin) e o JSON da conta de servico do Firebase. Guardar em cofre de senhas.
3. **Banco**: rodar o script acima (idealmente agendado, diario) e copiar `backups/` para outro local.
