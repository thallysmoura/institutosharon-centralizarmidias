import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { FirebaseService } from './firebase.service';
import { SessaoService } from './sessao.service';

@Module({ controllers: [AuthController], providers: [FirebaseService, SessaoService] })
export class AuthModule {}
