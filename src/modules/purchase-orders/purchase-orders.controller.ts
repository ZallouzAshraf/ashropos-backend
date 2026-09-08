import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { AuthUser } from '../../common/types/auth-user';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderStatusDto,
} from './dto/purchase-order.dto';
import { PurchaseOrdersService } from './purchase-orders.service';

@ApiTags('purchase-orders')
@ApiBearerAuth()
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Get()
  @RequirePermissions(Permission.PURCHASE_ORDERS_READ)
  @ApiQuery({ name: 'storeId', required: true })
  list(
    @CurrentUser() user: AuthUser,
    @Query('storeId', ParseUUIDPipe) storeId: string,
  ) {
    return this.purchaseOrdersService.list(user, storeId);
  }

  @Post()
  @RequirePermissions(Permission.PURCHASE_ORDERS_MANAGE)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrdersService.create(user, dto);
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.PURCHASE_ORDERS_MANAGE)
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseOrderStatusDto,
  ) {
    return this.purchaseOrdersService.updateStatus(user, id, dto);
  }
}
