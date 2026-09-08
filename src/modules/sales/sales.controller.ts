import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { Permission } from '../../common/enums/permission.enum';
import { AuthUser } from '../../common/types/auth-user';
import { CreateSaleDto } from './dto/sale.dto';
import { SalesService } from './sales.service';

@ApiTags('sales')
@ApiBearerAuth()
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @RequirePermissions(Permission.SALES_READ)
  @ApiQuery({ name: 'storeId', required: true })
  list(
    @CurrentUser() user: AuthUser,
    @Query('storeId', ParseUUIDPipe) storeId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.salesService.list(user, storeId, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.SALES_READ)
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.get(user, id);
  }

  @Post()
  @RequirePermissions(Permission.SALES_CREATE)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSaleDto) {
    return this.salesService.create(user, dto);
  }
}
