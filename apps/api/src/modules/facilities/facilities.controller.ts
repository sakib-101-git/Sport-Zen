import {
  Controller,
  Get,
  Query,
  Param,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FacilitiesService, NearbySearchParams } from './facilities.service';
import { IsNumber, IsOptional, IsString, IsBoolean, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

class NearbySearchDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  lng: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(100)
  @Type(() => Number)
  radiusKm?: number;

  @IsOptional()
  @IsString()
  sport?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  @Type(() => Number)
  rating?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  availableNow?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}

class ReviewsQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number;
}

@ApiTags('facilities')
@Controller('facilities')
export class FacilitiesController {
  constructor(private readonly facilitiesService: FacilitiesService) {}

  @Get('nearby')
  @ApiOperation({ summary: 'Search for nearby facilities' })
  @ApiQuery({ name: 'lat', type: Number, required: true })
  @ApiQuery({ name: 'lng', type: Number, required: true })
  @ApiQuery({ name: 'radiusKm', type: Number, required: false })
  @ApiQuery({ name: 'sport', type: String, required: false })
  @ApiQuery({ name: 'minPrice', type: Number, required: false })
  @ApiQuery({ name: 'maxPrice', type: Number, required: false })
  @ApiQuery({ name: 'rating', type: Number, required: false })
  @ApiQuery({ name: 'availableNow', type: Boolean, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  async searchNearby(@Query() query: NearbySearchDto) {
    const params: NearbySearchParams = {
      lat: query.lat,
      lng: query.lng,
      radiusKm: query.radiusKm,
      sportType: query.sport,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      minRating: query.rating,
      availableNow: query.availableNow,
      page: query.page,
      limit: query.limit,
    };

    const result = await this.facilitiesService.searchNearby(params);
    return { success: true, data: result };
  }

  @Get('sports')
  @ApiOperation({ summary: 'Get all sport types' })
  async getSportTypes() {
    const sports = await this.facilitiesService.getSportTypes();
    return { success: true, data: sports };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get facility details' })
  async getFacility(@Param('id', ParseUUIDPipe) id: string) {
    const facility = await this.facilitiesService.getFacilityById(id);
    return { success: true, data: facility };
  }

  @Get(':id/play-areas')
  @ApiOperation({ summary: 'Get facility play areas with sport profiles' })
  async getPlayAreas(@Param('id', ParseUUIDPipe) id: string) {
    const playAreas = await this.facilitiesService.getFacilityPlayAreas(id);
    return { success: true, data: playAreas };
  }

  @Get(':id/reviews')
  @ApiOperation({ summary: 'Get facility reviews' })
  async getReviews(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ReviewsQueryDto,
  ) {
    const result = await this.facilitiesService.getFacilityReviews(
      id,
      query.page,
      query.limit,
    );
    return { success: true, data: result };
  }
}
