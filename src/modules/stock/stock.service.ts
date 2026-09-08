import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { StockMovementType } from '../../common/enums/permission.enum';
import { AuthUser } from '../../common/types/auth-user';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { Product } from '../products/entities/product.entity';
import { StoresService } from '../stores/stores.service';
import {
  StockAdjustParams,
  StockMovementDto,
  StockTransferDto,
} from './dto/stock.dto';
import { StockMovement } from './entities/stock-movement.entity';
import { Stock } from './entities/stock.entity';

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Stock) private readonly stockRepo: Repository<Stock>,
    private readonly storesService: StoresService,
  ) {}

  async listByStore(user: AuthUser, storeId: string) {
    await this.storesService.requireStore(user, storeId);
    return this.stockRepo.find({
      where: { organizationId: user.organizationId, storeId },
      relations: ['product', 'variant'],
      order: { updatedAt: 'DESC' },
    });
  }

  async lowStock(user: AuthUser, storeId?: string) {
    const qb = this.stockRepo
      .createQueryBuilder('stock')
      .leftJoinAndSelect('stock.product', 'product')
      .leftJoinAndSelect('stock.variant', 'variant')
      .where('stock.organization_id = :orgId', { orgId: user.organizationId })
      .andWhere('stock.quantity <= stock.min_threshold');
    if (storeId) {
      await this.storesService.requireStore(user, storeId);
      qb.andWhere('stock.store_id = :storeId', { storeId });
    }
    return qb.getMany();
  }

  async move(user: AuthUser, dto: StockMovementDto) {
    if (
      dto.type === StockMovementType.TRANSFER_IN ||
      dto.type === StockMovementType.TRANSFER_OUT
    ) {
      throw new BadRequestException('Use /stock/transfer for store transfers');
    }
    await this.storesService.requireStore(user, dto.storeId);
    const delta = this.deltaForType(dto.type, dto.quantity);

    return this.dataSource.transaction(async (manager) => {
      const stock = await this.adjust(manager, {
        organizationId: user.organizationId,
        storeId: dto.storeId,
        productId: dto.productId,
        variantId: dto.variantId ?? null,
        delta,
        type: dto.type,
        reason: dto.reason ?? null,
        createdBy: user.id,
      });
      if (dto.minThreshold !== undefined) {
        stock.minThreshold = dto.minThreshold;
        await manager.save(stock);
      }
      return stock;
    });
  }

  async transfer(user: AuthUser, dto: StockTransferDto) {
    if (dto.sourceStoreId === dto.targetStoreId) {
      throw new BadRequestException('Source and target stores must differ');
    }
    await this.storesService.requireStore(user, dto.sourceStoreId);
    await this.storesService.requireStore(user, dto.targetStoreId);

    const product = await this.dataSource.manager.findOne(Product, {
      where: {
        id: dto.productId,
        organizationId: user.organizationId,
        storeId: dto.sourceStoreId,
      },
      relations: ['variants'],
    });
    if (!product) {
      throw new NotFoundException('Product not found in source store');
    }

    return this.dataSource.transaction(async (manager) => {
      const source = await this.adjust(manager, {
        organizationId: user.organizationId,
        storeId: dto.sourceStoreId,
        productId: dto.productId,
        variantId: dto.variantId ?? null,
        delta: -dto.quantity,
        type: StockMovementType.TRANSFER_OUT,
        reason: dto.reason ?? 'Inter-store transfer',
        relatedStoreId: dto.targetStoreId,
        createdBy: user.id,
      });

      const catalog = await this.ensureTargetCatalog(
        manager,
        user.organizationId,
        dto.targetStoreId,
        product,
        dto.variantId ?? null,
      );

      const target = await this.adjust(manager, {
        organizationId: user.organizationId,
        storeId: dto.targetStoreId,
        productId: catalog.productId,
        variantId: catalog.variantId,
        delta: dto.quantity,
        type: StockMovementType.TRANSFER_IN,
        reason: dto.reason ?? 'Inter-store transfer',
        relatedStoreId: dto.sourceStoreId,
        createdBy: user.id,
      });

      return { source, target };
    });
  }

  /**
   * Pessimistic-locked stock mutation. Used by movements, transfers and sales.
   */
  async adjust(
    manager: EntityManager,
    params: StockAdjustParams,
  ): Promise<Stock> {
    if (params.delta === 0) {
      throw new BadRequestException('Quantity delta cannot be zero');
    }

    const qb = manager
      .createQueryBuilder(Stock, 'stock')
      .setLock('pessimistic_write')
      .where('stock.organization_id = :orgId', {
        orgId: params.organizationId,
      })
      .andWhere('stock.store_id = :storeId', { storeId: params.storeId })
      .andWhere('stock.product_id = :productId', {
        productId: params.productId,
      });

    if (params.variantId) {
      qb.andWhere('stock.variant_id = :variantId', {
        variantId: params.variantId,
      });
    } else {
      qb.andWhere('stock.variant_id IS NULL');
    }

    let stock = await qb.getOne();
    if (!stock) {
      if (params.delta < 0 && !params.allowNegative) {
        throw new BadRequestException('Insufficient stock');
      }
      stock = manager.create(Stock, {
        organizationId: params.organizationId,
        storeId: params.storeId,
        productId: params.productId,
        variantId: params.variantId ?? null,
        quantity: 0,
        minThreshold: 0,
      });
    }

    const next = stock.quantity + params.delta;
    if (next < 0 && !params.allowNegative) {
      throw new BadRequestException(
        `Insufficient stock (available: ${stock.quantity})`,
      );
    }
    stock.quantity = next;
    await manager.save(stock);

    if (params.variantId) {
      await manager.increment(
        ProductVariant,
        {
          id: params.variantId,
          organizationId: params.organizationId,
        },
        'stockQuantity',
        params.delta,
      );
    }

    await manager.save(
      manager.create(StockMovement, {
        organizationId: params.organizationId,
        storeId: params.storeId,
        productId: params.productId,
        variantId: params.variantId ?? null,
        type: params.type,
        quantity: Math.abs(params.delta),
        reason: params.reason ?? null,
        relatedStoreId: params.relatedStoreId ?? null,
        createdBy: params.createdBy ?? null,
      }),
    );

    return stock;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scanLowStock(): Promise<void> {
    const rows = await this.stockRepo
      .createQueryBuilder('stock')
      .where('stock.quantity <= stock.min_threshold')
      .andWhere('stock.min_threshold > 0')
      .getCount();
    if (rows > 0) {
      this.logger.warn(`Low-stock alert: ${rows} SKU(s) at or below threshold`);
    }
  }

  private deltaForType(type: StockMovementType, quantity: number): number {
    const abs = Math.abs(quantity);
    if (abs === 0) {
      throw new BadRequestException('Quantity cannot be zero');
    }
    switch (type) {
      case StockMovementType.IN:
        return abs;
      case StockMovementType.OUT:
        return -abs;
      case StockMovementType.CORRECTION:
        return quantity;
      default:
        throw new BadRequestException(`Unsupported movement type ${type}`);
    }
  }

  private async ensureTargetCatalog(
    manager: EntityManager,
    organizationId: string,
    targetStoreId: string,
    sourceProduct: Product,
    sourceVariantId: string | null,
  ): Promise<{ productId: string; variantId: string | null }> {
    let targetProduct: Product | null = null;
    if (sourceProduct.sku) {
      targetProduct = await manager.findOne(Product, {
        where: {
          organizationId,
          storeId: targetStoreId,
          sku: sourceProduct.sku,
        },
      });
    }
    if (!targetProduct) {
      targetProduct = manager.create(Product, {
        organizationId,
        storeId: targetStoreId,
        name: sourceProduct.name,
        sku: sourceProduct.sku,
        barcode: sourceProduct.barcode,
        purchasePrice: sourceProduct.purchasePrice,
        sellingPrice: sourceProduct.sellingPrice,
        tax: sourceProduct.tax,
        images: sourceProduct.images,
        description: sourceProduct.description,
        isActive: true,
      });
      await manager.save(targetProduct);
    }

    if (!sourceVariantId) {
      return { productId: targetProduct.id, variantId: null };
    }

    const sourceVariant = await manager.findOne(ProductVariant, {
      where: { id: sourceVariantId, organizationId, productId: sourceProduct.id },
    });
    if (!sourceVariant) {
      throw new NotFoundException('Variant not found');
    }

    let targetVariant: ProductVariant | null = null;
    if (sourceVariant.sku) {
      targetVariant = await manager.findOne(ProductVariant, {
        where: {
          organizationId,
          storeId: targetStoreId,
          productId: targetProduct.id,
          sku: sourceVariant.sku,
        },
      });
    }
    if (!targetVariant) {
      targetVariant = manager.create(ProductVariant, {
        organizationId,
        storeId: targetStoreId,
        productId: targetProduct.id,
        attributes: sourceVariant.attributes,
        sku: sourceVariant.sku,
        barcode: sourceVariant.barcode,
        sellingPriceOverride: sourceVariant.sellingPriceOverride,
        stockQuantity: 0,
        isActive: true,
      });
      await manager.save(targetVariant);
    }

    return { productId: targetProduct.id, variantId: targetVariant.id };
  }
}
