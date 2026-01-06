import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('SportZen API')
    .setDescription(`
## SportZen Turf Booking Platform API

This API powers the SportZen platform for booking sports facilities (turfs) in Bangladesh.

### Key Features
- **Facility Search**: Find nearby turfs with filters for sport type, price, rating, and availability
- **Booking System**: Create holds, confirm payments, and manage bookings
- **Payment Integration**: SSLCommerz payment gateway with webhook confirmation
- **Owner Portal**: Manage facilities, view bookings, handle offline payments
- **Admin Portal**: Approve facilities, process refunds, moderate reviews

### Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

### Common Response Codes
- \`200\` - Success
- \`201\` - Created
- \`400\` - Bad Request (validation error)
- \`401\` - Unauthorized
- \`403\` - Forbidden (insufficient permissions)
- \`404\` - Not Found
- \`409\` - Conflict (e.g., slot already booked)
- \`500\` - Internal Server Error

### Error Response Format
\`\`\`json
{
  "code": "ERROR_CODE",
  "message": "Human readable error message",
  "details": [...],
  "correlationId": "uuid-for-support"
}
\`\`\`

### Timezone
All timestamps are stored in UTC. Display should use Asia/Dhaka timezone.
    `)
    .setVersion('1.0')
    .setContact(
      'SportZen Support',
      'https://sportzen.com',
      'support@sportzen.com',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT',
    )
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Facilities', 'Facility search and details')
    .addTag('Availability', 'Slot availability')
    .addTag('Bookings', 'Booking management')
    .addTag('Payments', 'Payment processing')
    .addTag('Reviews', 'Facility reviews')
    .addTag('Owner', 'Owner portal endpoints')
    .addTag('Admin', 'Super admin endpoints')
    .addTag('Health', 'System health checks')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  });

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      docExpansion: 'none',
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'SportZen API Documentation',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin-bottom: 20px }
      .swagger-ui .scheme-container { background: #1a1a1a; padding: 15px; border-radius: 5px }
    `,
  });
}

// DTO Decorators for Swagger documentation
export {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiProperty,
  ApiPropertyOptional,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiConsumes,
  ApiProduces,
  ApiExcludeEndpoint,
  ApiExcludeController,
} from '@nestjs/swagger';
