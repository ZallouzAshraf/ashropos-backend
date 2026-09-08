import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { StockMovementType } from '../../../common/enums/permission.enum';

export class StockMovementDto {
  @ApiProperty()
  @IsUUID()
  storeId: string;

  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ enum: StockMovementType })
  @IsEnum(StockMovementType)
  type: StockMovementType;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minThreshold?: number;
}

export class StockTransferDto {
  @ApiProperty()
  @IsUUID()
  sourceStoreId: string;

  @ApiProperty()
  @IsUUID()
  targetStoreId: string;

  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export interface StockAdjustParams {
  organizationId: string;
  storeId: string;
  productId: string;
  variantId?: string | null;
  delta: number;
  type: StockMovementType;
  reason?: string | null;
  relatedStoreId?: string | null;
  createdBy?: string | null;
  allowNegative?: boolean;
}
