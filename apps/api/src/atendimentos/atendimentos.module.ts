import { Module } from '@nestjs/common';
import { AdminController, CidadesController, AtendimentosController, FotosController } from './atendimentos.controller';

@Module({ controllers: [CidadesController, AtendimentosController, AdminController, FotosController] })
export class AtendimentosModule {}
