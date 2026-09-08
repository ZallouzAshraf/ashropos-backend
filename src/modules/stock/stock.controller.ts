import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { AuthUser } from '../../common/types/auth-user';
import { StockMovementDto, StockTransferDto } from './dto/stock.dto';
import { StockService } from './stock.service';

@ApiTags('stock')
@ApiBearerAuth()
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('alerts')
  @RequirePermissions(Permission.STOCK_READ)
  alerts(
    @CurrentUser() user: AuthUser,
    @Query('storeId') storeId?: string,
  ) {
    return this.stockService.lowStock(user, storeId);
  }

  @Get(':storeId')
  @RequirePermissions(Permission.STOCK_READ)
  list(
    @CurrentUser() user: AuthUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ) {
    return this.stockService.listByStore(user, storeId);
  }

  @Post('movement')
  @RequirePermissions(Permission.STOCK_MOVEMENT)
  movement(@CurrentUser() user: AuthUser, @Body() dto: StockMovementDto) {
    return this.stockService.move(user, dto);
  }

  @Post('transfer')
  @RequirePermissions(Permission.STOCK_TRANSFER)
  transfer(@CurrentUser() user: AuthUser, @Body() dto: StockTransferDto) {
    return this.stockService.transfer(user, dto);
  }
}
