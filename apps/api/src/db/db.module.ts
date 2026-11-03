import { Global, Module } from '@nestjs/common';
import { DbService } from './db.service';
import { AuditoriaService } from './auditoria.service';

@Global()
@Module({ providers: [DbService, AuditoriaService], exports: [DbService, AuditoriaService] })
export class DbModule {}
