import { DashboardController } from './dashboard.controller';
import { Module } from '@nestjs/common';
import { AdminController, CidadesController, AtendimentosController, FotosController } from './atendimentos.controller';

@Module({ controllers: [CidadesController, AtendimentosController, AdminController, DashboardController, FotosController] })
export class AtendimentosModule {}
