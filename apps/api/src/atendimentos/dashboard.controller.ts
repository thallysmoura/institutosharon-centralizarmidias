import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import ExcelJS from 'exceljs';
import { DbService } from '../db/db.service';
import { AuthGuard, Roles } from '../common/auth';

const TZ = 'America/Manaus';
const DIAS_OK = [7, 30, 90, 365];
const periodo = (v?: string) => { const n = Number(v); return DIAS_OK.includes(n) ? n : 30; };

/** Indicadores e exportação para o gestor: visão geral do período (30 dias por padrão). */
@Controller('admin')
@UseGuards(AuthGuard)
@Roles('ADMIN')
export class DashboardController {
  constructor(private readonly db: DbService) {}

  @Get('dashboard')
  async dashboard(@Query('dias') diasQ?: string) {
    const dias = periodo(diasQ);
    const q = (sql: string) => this.db.query(sql, [dias]).then((r) => r.rows);
    const ini = "created_at >= now() - make_interval(days => $1::int)";
    const [kpi, fotosDia, atendDia, cidades, alunos, disp, horas] = await Promise.all([
      q(`SELECT
          (SELECT count(*)::int FROM sistema.fotos) AS fotos,
          (SELECT count(*)::int FROM sistema.atendimentos) AS atendimentos,
          (SELECT count(DISTINCT lower(trim(identificador_paciente)))::int FROM sistema.atendimentos) AS pacientes,
          (SELECT count(*)::int FROM sistema.users WHERE role='ALUNO') AS alunos,
          (SELECT count(*)::int FROM sistema.cidades) AS cidades,
          (SELECT count(*)::int FROM sistema.fotos WHERE oculta_em IS NOT NULL) AS ocultas,
          (SELECT COALESCE(sum(bytes + thumb_bytes),0)::bigint FROM sistema.fotos) AS bytes,
          (SELECT count(*)::int FROM sistema.fotos WHERE (created_at AT TIME ZONE '${TZ}')::date = (now() AT TIME ZONE '${TZ}')::date) AS fotos_hoje,
          (SELECT count(*)::int FROM sistema.fotos WHERE ${ini}) AS fotos_periodo,
          (SELECT count(*)::int FROM sistema.fotos WHERE created_at >= now() - make_interval(days => 2 * $1::int) AND created_at < now() - make_interval(days => $1::int)) AS fotos_anterior,
          (SELECT count(*)::int FROM sistema.atendimentos WHERE ${ini}) AS atend_periodo,
          (SELECT count(*)::int FROM sistema.atendimentos WHERE created_at >= now() - make_interval(days => 2 * $1::int) AND created_at < now() - make_interval(days => $1::int)) AS atend_anterior,
          (SELECT count(DISTINCT aluno_id)::int FROM sistema.atendimentos WHERE ${ini}) AS alunos_ativos`),
      q(`SELECT to_char((created_at AT TIME ZONE '${TZ}')::date,'YYYY-MM-DD') AS dia, count(*)::int AS n FROM sistema.fotos WHERE created_at >= now() - make_interval(days => $1::int + 1) GROUP BY 1`),
      q(`SELECT to_char((created_at AT TIME ZONE '${TZ}')::date,'YYYY-MM-DD') AS dia, count(*)::int AS n FROM sistema.atendimentos WHERE created_at >= now() - make_interval(days => $1::int + 1) GROUP BY 1`),
      q(`SELECT c.nome AS cidade, count(f.id)::int AS fotos, count(DISTINCT a.id)::int AS atendimentos, count(DISTINCT a.aluno_id)::int AS alunos
           FROM sistema.cidades c LEFT JOIN sistema.atendimentos a ON a.cidade_id=c.id AND a.created_at >= now() - make_interval(days => $1::int)
           LEFT JOIN sistema.fotos f ON f.atendimento_id=a.id GROUP BY c.id ORDER BY fotos DESC, c.nome`),
      q(`SELECT u.id, u.nome, u.matricula, ci.nome AS cidade, count(f.id)::int AS fotos, count(DISTINCT a.id)::int AS atendimentos
           FROM sistema.atendimentos a JOIN sistema.users u ON u.id=a.aluno_id LEFT JOIN sistema.cidades ci ON ci.id=a.cidade_id LEFT JOIN sistema.fotos f ON f.atendimento_id=a.id
          WHERE a.created_at >= now() - make_interval(days => $1::int) GROUP BY u.id, ci.nome ORDER BY fotos DESC, u.nome LIMIT 8`),
      q(`SELECT COALESCE(dispositivo,'Não registrado') AS nome, count(*)::int AS n FROM sistema.fotos WHERE ${ini} GROUP BY 1 ORDER BY n DESC`),
      q(`SELECT extract(hour FROM created_at AT TIME ZONE '${TZ}')::int AS h, count(*)::int AS n FROM sistema.fotos WHERE ${ini} GROUP BY 1`),
    ]);

    const f = new Map(fotosDia.map((r) => [r.dia as string, r.n as number]));
    const a = new Map(atendDia.map((r) => [r.dia as string, r.n as number]));
    const hoje = new Date(Date.now() - 4 * 3600e3); // Manaus (UTC-4, sem horário de verão)
    const porDia = Array.from({ length: dias }, (_, i) => {
      const d = new Date(hoje.getTime() - (dias - 1 - i) * 864e5).toISOString().slice(0, 10);
      return { dia: d, fotos: f.get(d) ?? 0, atendimentos: a.get(d) ?? 0 };
    });
    const h = new Map(horas.map((r) => [r.h as number, r.n as number]));
    return { dias, kpi: kpi[0], porDia, porCidade: cidades, topAlunos: alunos, dispositivos: disp, porHora: Array.from({ length: 24 }, (_, i) => ({ hora: i, fotos: h.get(i) ?? 0 })) };
  }

  /** Planilha Excel com resumo, atendimentos, fotos, alunos e cidades (dias=0 exporta tudo). */
  @Get('exportar')
  async exportar(@Res() res: Response, @Query('dias') diasQ?: string) {
    const dias = diasQ === '0' ? 0 : periodo(diasQ);
    const filtro = dias ? `AND a.created_at >= now() - make_interval(days => ${dias})` : '';
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Instituto Sharon - Fotos Clínicas';
    wb.created = new Date();
    const dt = (c: string) => `to_char(${c} AT TIME ZONE '${TZ}','DD/MM/YYYY HH24:MI')`;

    const aba = (nome: string, colunas: [string, number][], linhas: unknown[][]) => {
      const ws = wb.addWorksheet(nome, { views: [{ state: 'frozen', ySplit: 1 }] });
      ws.columns = colunas.map(([header, width]) => ({ header, width }));
      linhas.forEach((l) => ws.addRow(l));
      const cab = ws.getRow(1);
      cab.height = 22;
      cab.eachCell((c) => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA67C26' } };
        c.alignment = { vertical: 'middle' };
      });
      if (linhas.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colunas.length } };
    };

    const kpi = (await this.db.query(`SELECT
        (SELECT count(*)::int FROM sistema.fotos) AS fotos, (SELECT count(*)::int FROM sistema.atendimentos) AS atendimentos,
        (SELECT count(DISTINCT lower(trim(identificador_paciente)))::int FROM sistema.atendimentos) AS pacientes,
        (SELECT count(*)::int FROM sistema.users WHERE role='ALUNO') AS alunos, (SELECT count(*)::int FROM sistema.cidades) AS cidades,
        (SELECT count(*)::int FROM sistema.fotos WHERE oculta_em IS NOT NULL) AS ocultas,
        (SELECT COALESCE(sum(bytes + thumb_bytes),0)::bigint FROM sistema.fotos) AS bytes`)).rows[0];
    aba('Resumo', [['Indicador', 34], ['Valor', 24]], [
      ['Gerado em', new Date().toLocaleString('pt-BR', { timeZone: TZ })],
      ['Período exportado', dias ? `Últimos ${dias} dias` : 'Todo o histórico'],
      ['Fotos recebidas (total)', kpi.fotos],
      ['Atendimentos (total)', kpi.atendimentos],
      ['Pacientes', kpi.pacientes],
      ['Alunos cadastrados', kpi.alunos],
      ['Cidades', kpi.cidades],
      ['Fotos excluídas pelos alunos', kpi.ocultas],
      ['Armazenamento usado (MB)', Math.round((Number(kpi.bytes) / 1048576) * 10) / 10],
    ]);

    const atend = (await this.db.query(`SELECT a.id, ${dt('a.created_at')} AS quando, a.identificador_paciente AS paciente, u.nome AS aluno, u.matricula, u.email, c.nome AS cidade, count(f.id)::int AS fotos,
        string_agg(DISTINCT f.dispositivo, ', ') AS dispositivos
        FROM sistema.atendimentos a JOIN sistema.users u ON u.id=a.aluno_id JOIN sistema.cidades c ON c.id=a.cidade_id LEFT JOIN sistema.fotos f ON f.atendimento_id=a.id
        WHERE true ${filtro} GROUP BY a.id, u.id, c.id ORDER BY a.created_at DESC LIMIT 50000`)).rows;
    aba('Atendimentos', [['Nº', 8], ['Data e horário', 18], ['Paciente', 26], ['Aluno', 28], ['Matrícula', 14], ['E-mail', 30], ['Cidade', 18], ['Fotos', 8], ['Dispositivos', 22]],
      atend.map((r) => [r.id, r.quando, r.paciente, r.aluno, r.matricula ?? '', r.email, r.cidade, r.fotos, r.dispositivos ?? '']));

    const fotos = (await this.db.query(`SELECT f.id, a.id AS atend, ${dt('f.created_at')} AS quando, a.identificador_paciente AS paciente, u.nome AS aluno, c.nome AS cidade,
        f.dispositivo, f.so, f.navegador, round(f.bytes/1024.0)::int AS kb, f.width, f.height, (f.oculta_em IS NOT NULL) AS oculta
        FROM sistema.fotos f JOIN sistema.atendimentos a ON a.id=f.atendimento_id JOIN sistema.users u ON u.id=a.aluno_id JOIN sistema.cidades c ON c.id=a.cidade_id
        WHERE true ${filtro} ORDER BY f.created_at DESC LIMIT 50000`)).rows;
    aba('Fotos', [['Foto', 8], ['Atendimento', 12], ['Data e horário', 18], ['Paciente', 26], ['Aluno', 28], ['Cidade', 18], ['Dispositivo', 14], ['Sistema', 12], ['Navegador', 12], ['Tamanho (KB)', 13], ['Largura', 10], ['Altura', 10], ['Situação', 20]],
      fotos.map((r) => [r.id, r.atend, r.quando, r.paciente, r.aluno, r.cidade, r.dispositivo ?? 'Não registrado', r.so ?? '', r.navegador ?? '', r.kb, r.width ?? '', r.height ?? '', r.oculta ? 'Excluída pelo aluno' : 'Visível']));

    const alunos = (await this.db.query(`SELECT u.nome, u.matricula, u.email, c.nome AS cidade, count(DISTINCT a.id)::int AS atend, count(f.id)::int AS fotos, ${dt('max(a.created_at)')} AS ultimo
        FROM sistema.users u LEFT JOIN sistema.cidades c ON c.id=u.cidade_id LEFT JOIN sistema.atendimentos a ON a.aluno_id=u.id ${filtro}
        LEFT JOIN sistema.fotos f ON f.atendimento_id=a.id WHERE u.role='ALUNO' GROUP BY u.id, c.nome ORDER BY fotos DESC, u.nome`)).rows;
    aba('Alunos', [['Aluno', 30], ['Matrícula', 14], ['E-mail', 32], ['Cidade', 18], ['Atendimentos', 14], ['Fotos', 10], ['Último envio', 18]],
      alunos.map((r) => [r.nome, r.matricula ?? '', r.email, r.cidade ?? '', r.atend, r.fotos, r.ultimo ?? '']));

    const cidades = (await this.db.query(`SELECT c.nome, count(DISTINCT a.aluno_id)::int AS alunos, count(DISTINCT a.id)::int AS atend, count(f.id)::int AS fotos
        FROM sistema.cidades c LEFT JOIN sistema.atendimentos a ON a.cidade_id=c.id ${filtro}
        LEFT JOIN sistema.fotos f ON f.atendimento_id=a.id GROUP BY c.id ORDER BY fotos DESC, c.nome`)).rows;
    aba('Cidades', [['Cidade', 24], ['Alunos ativos', 14], ['Atendimentos', 14], ['Fotos', 10]], cidades.map((r) => [r.nome, r.alunos, r.atend, r.fotos]));

    const nome = `fotos-clinicas-sharon-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
    res.setHeader('Cache-Control', 'no-store');
    await wb.xlsx.write(res);
    res.end();
  }
}
