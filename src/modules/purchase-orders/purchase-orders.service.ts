import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PurchaseOrderStatus, StockMovementType } from '../../common/enums/permission.enum';
import { AuthUser } from '../../common/types/auth-user';
import { roundMoney } from '../../common/utils/helpers';
import { StockService } from '../stock/stock.service';
import { StoresService } from '../stores/stores.service';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderStatusDto,
} from './dto/purchase-order.dto';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { PurchaseOrder } from './entities/purchase-order.entity';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PurchaseOrder)
    private readonly ordersRepo: Repository<PurchaseOrder>,
    private readonly storesService: StoresService,
    private readonly stockService: StockService,
  ) {}

  async list(user: AuthUser, storeId: string) {
    await this.storesService.requireStore(user, storeId);
    return this.ordersRepo.find({
      where: { organizationId: user.organizationId, storeId },
      relations: ['items', 'supplier'],
      order: { createdAt: 'DESC' },
    });
  }

  async create(user: AuthUser, dto: CreatePurchaseOrderDto) {
    await this.storesService.requireStore(user, dto.storeId);
    const totalCost = roundMoney(
      dto.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0),
    );
    return this.dataSource.transaction(async (manager) => {
      const order = manager.create(PurchaseOrder, {
        organizationId: user.organizationId,
        storeId: dto.storeId,
        supplierId: dto.supplierId,
        status: PurchaseOrderStatus.DRAFT,
        expectedDate: dto.expectedDate ?? null,
        notes: dto.notes ?? null,
        totalCost: String(totalCost),
      });
      await manager.save(order);
      for (const item of dto.items) {
        await manager.save(
          manager.create(PurchaseOrderItem, {
            organizationId: user.organizationId,
            purchaseOrderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            unitCost: String(item.unitCost),
          }),
        );
      }
      return manager.findOne(PurchaseOrder, {
        where: { id: order.id, organizationId: user.organizationId },
        relations: ['items'],
      });
    });
  }

  async updateStatus(
    user: AuthUser,
    id: string,
    dto: UpdatePurchaseOrderStatusDto,
  ) {
    const order = await this.ordersRepo.findOne({
      where: { id, organizationId: user.organizationId },
      relations: ['items'],
    });
    if (!order) {
      throw new NotFoundException('Purchase order not found');
    }
    await this.storesService.requireStore(user, order.storeId);

    if (dto.status === PurchaseOrderStatus.RECEIVED && order.status !== PurchaseOrderStatus.RECEIVED) {
      await this.dataSource.transaction(async (manager) => {
        for (const item of order.items) {
          await this.stockService.adjust(manager, {
            organizationId: user.organizationId,
            storeId: order.storeId,
            productId: item.productId,
            variantId: null,
            delta: item.quantity,
            type: StockMovementType.IN,
            reason: `PO ${order.id} received`,
            createdBy: user.id,
          });
          item.receivedQuantity = item.quantity;
          await manager.save(item);
        }
        order.status = PurchaseOrderStatus.RECEIVED;
        await manager.save(order);
      });
      return this.ordersRepo.findOne({
        where: { id: order.id, organizationId: user.organizationId },
        relations: ['items'],
      });
    }

    order.status = dto.status;
    return this.ordersRepo.save(order);
  }
}
