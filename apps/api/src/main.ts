import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const isProduction = process.env.NODE_ENV === 'production';

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Security: Helmet for secure HTTP headers
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false, // Disable CSP in dev for Swagger
      crossOriginEmbedderPolicy: false, // Required for SSLCommerz redirects
    }),
  );

  // Security: Request body limits
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // CORS configuration
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'https://sandbox.sslcommerz.com',
    'https://securepay.sslcommerz.com',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.some((allowed) => origin.startsWith(allowed))) {
        return callback(null, true);
      }

      // In development, allow any localhost
      if (!isProduction && origin.includes('localhost')) {
        return callback(null, true);
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Correlation-ID',
      'X-Request-ID',
    ],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger documentation (disabled in production)
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('SportZen API')
      .setDescription('Turf Booking Platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('facilities', 'Facility management')
      .addTag('availability', 'Slot availability')
      .addTag('bookings', 'Booking management')
      .addTag('payments', 'Payment processing')
      .addTag('owner', 'Owner panel')
      .addTag('admin', 'Admin panel')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Health check endpoint (before global prefix)
  app.getHttpAdapter().get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    });
  });

  app.getHttpAdapter().get('/ready', (req, res) => {
    // Could add database/redis connectivity checks here
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);

  logger.log(`Application running on: http://localhost:${port}`);
  if (!isProduction) {
    logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
