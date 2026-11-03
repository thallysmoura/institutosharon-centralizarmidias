import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { DbModule } from './db/db.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { AtendimentosModule } from './atendimentos/atendimentos.module';
import { PerfilModule } from './perfil/perfil.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DbModule,
    StorageModule,
    HealthModule,
    AuthModule,
    AtendimentosModule,
    MailModule,
    PerfilModule,
  ],
})
export class AppModule {}
