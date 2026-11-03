import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { FirebaseService } from './firebase.service';

@Module({ controllers: [AuthController], providers: [FirebaseService] })
export class AuthModule {}
