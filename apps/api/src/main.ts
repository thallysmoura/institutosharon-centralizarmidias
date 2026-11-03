import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { exceptionFactory } from './common/validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  const port = config.get<number>('PORT', 3001);
  const corsOrigins = config
    .get<string>('CORS_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  const segredo = config.get<string>('JWT_SECRET', '');
  if (segredo.length < 32) Logger.warn('JWT_SECRET curto: use ao menos 32 caracteres aleatórios.', 'Seguranca');
  if (config.get('TRUST_PROXY')) app.getHttpAdapter().getInstance().set('trust proxy', Number(config.get('TRUST_PROXY')) || 1); // atrás de proxy: IP real para o rate limit
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // o front (outra origem) carrega as imagens da API
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      referrerPolicy: { policy: 'no-referrer' },
      hsts: { maxAge: 15552000, includeSubDomains: true },
    }),
  );
  app.use(cookieParser());
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, exceptionFactory }));
  app.setGlobalPrefix('', { exclude: ['health'] });

  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on :${port}`, 'Bootstrap');
}

bootstrap();
