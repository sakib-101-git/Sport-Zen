import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  ValidationError,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

export interface ValidationErrorResponse {
  code: string;
  message: string;
  details: ValidationErrorDetail[];
}

export interface ValidationErrorDetail {
  field: string;
  constraints: string[];
}

@Injectable()
export class CustomValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(metatype, value, {
      enableImplicitConversion: true,
      excludeExtraneousValues: false,
    });

    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      skipMissingProperties: false,
    });

    if (errors.length > 0) {
      const errorResponse = this.buildErrorResponse(errors);
      throw new BadRequestException(errorResponse);
    }

    return object;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private buildErrorResponse(errors: ValidationError[]): ValidationErrorResponse {
    const details: ValidationErrorDetail[] = [];

    const extractErrors = (error: ValidationError, parentPath = '') => {
      const fieldPath = parentPath ? `${parentPath}.${error.property}` : error.property;

      if (error.constraints) {
        details.push({
          field: fieldPath,
          constraints: Object.values(error.constraints),
        });
      }

      if (error.children && error.children.length > 0) {
        error.children.forEach((child) => extractErrors(child, fieldPath));
      }
    };

    errors.forEach((error) => extractErrors(error));

    return {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details,
    };
  }
}

// Export a pre-configured instance for convenience
export const validationPipe = new CustomValidationPipe();
