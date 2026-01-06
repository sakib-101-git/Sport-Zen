import {
  Controller,
  Get,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AvailabilityService } from './availability.service';
import { IsString, IsDateString, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { parseISO, startOfDay, isValid } from 'date-fns';

class AvailabilityQueryDto {
  @IsUUID()
  conflictGroupId: string;

  @IsUUID()
  sportProfileId: string;

  @IsString()
  date: string; // YYYY-MM-DD format
}

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get()
  @ApiOperation({ summary: 'Get availability grid for a conflict group' })
  @ApiQuery({ name: 'conflictGroupId', type: String, required: true })
  @ApiQuery({ name: 'sportProfileId', type: String, required: true })
  @ApiQuery({ name: 'date', type: String, required: true, description: 'Date in YYYY-MM-DD format' })
  async getAvailability(@Query() query: AvailabilityQueryDto) {
    // Parse and validate date
    const dateObj = parseISO(query.date);
    if (!isValid(dateObj)) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    const grid = await this.availabilityService.getAvailabilityGrid(
      query.conflictGroupId,
      query.sportProfileId,
      startOfDay(dateObj),
    );

    return { success: true, data: grid };
  }
}
