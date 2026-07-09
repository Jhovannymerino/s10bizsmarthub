import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.enableShutdownHooks();

  const { json, urlencoded } = await import('express');
  app.use(json({ limit: '100mb' }));
  app.use(urlencoded({ limit: '100mb', extended: true }));

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3100'],
    credentials: true,
  });

  // Swagger
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('S10 BizSmartHub API')
      .setDescription('KPI financieros desde S10 ERP')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = parseInt(process.env.PORT || '3202', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`S10 BizSmartHub API running on port ${port}`);

  // PID 1 sin handler explicito IGNORA SIGTERM -> Docker espera el grace period
  // y mata con SIGKILL (exit 137), dejando el recreate a medias. Ver CLAUDE.md #23.
  process.on('SIGTERM', () => app.close().then(() => process.exit(0)));
  process.on('SIGINT', () => app.close().then(() => process.exit(0)));
}

bootstrap();
