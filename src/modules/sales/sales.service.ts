import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PaymentMethod, SaleStatus, StockMovementType } from '../../common/enums/permission.enum';
import { AuthUser } from '../../common/types/auth-user';
import { toNumber } from '../../common/utils/helpers';
import { computeSaleTotals } from '../../common/utils/sale-calculator';
import { Customer } from '../customers/entities/customer.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { Product } from '../products/entities/product.entity';
import { StockService } from '../stock/stock.service';
import { StoresService } from '../stores/stores.service';
import { CreateSaleDto } from './dto/sale.dto';
import { Payment } from './entities/payment.entity';
import { SaleItem } from './entities/sale-item.entity';
import { Sale } from './entities/sale.entity';

@Injectable()
export class SalesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Sale) private readonly salesRepo: Repository<Sale>,
    private readonly storesService: StoresService,
    private readonly stockService: StockService,
  ) {}

  async list(user: AuthUser, storeId: string, query: PaginationQueryDto) {
    await this.storesService.requireStore(user, storeId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await this.salesRepo.findAndCount({
      where: { organizationId: user.organizationId, storeId },
      relations: ['items', 'payments', 'cashier'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async get(user: AuthUser, id: string) {
    const sale = await this.salesRepo.findOne({
      where: { id, organizationId: user.organizationId },
      relations: ['items', 'payments', 'cashier', 'customer'],
    });
    if (!sale) {
      throw new NotFoundException('Sale not found');
    }
    await this.storesService.requireStore(user, sale.storeId);
    return sale;
  }

  async create(user: AuthUser, dto: CreateSaleDto) {
    await this.storesService.requireStore(user, dto.storeId);

    if (dto.clientGeneratedId) {
      const existing = await this.salesRepo.findOne({
        where: {
          organizationId: user.organizationId,
          storeId: dto.storeId,
          clientGeneratedId: dto.clientGeneratedId,
        },
        relations: ['items', 'payments'],
      });
      if (existing) {
        return existing;
      }
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const resolvedItems = [];
        for (const item of dto.items) {
          const product = await manager.findOne(Product, {
            where: {
              id: item.productId,
              organizationId: user.organizationId,
              storeId: dto.storeId,
              isActive: true,
            },
          });
          if (!product) {
            throw new NotFoundException(`Product ${item.productId} not found`);
          }

          let variant: ProductVariant | null = null;
          let catalogPrice = toNumber(product.sellingPrice);
          if (item.variantId) {
            variant = await manager.findOne(ProductVariant, {
              where: {
                id: item.variantId,
                productId: product.id,
                organizationId: user.organizationId,
                isActive: true,
              },
            });
            if (!variant) {
              throw new NotFoundException(`Variant ${item.variantId} not found`);
            }
            if (variant.sellingPriceOverride) {
              catalogPrice = toNumber(variant.sellingPriceOverride);
            }
          }

          resolvedItems.push({
            product,
            variant,
            quantity: item.quantity,
            unitPrice: item.unitPrice ?? catalogPrice,
            discount: item.discount ?? 0,
            taxRate: toNumber(product.tax),
            purchasePrice: toNumber(product.purchasePrice),
          });
        }

        const totals = computeSaleTotals(
          resolvedItems.map((item) => ({
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            taxRate: item.taxRate,
          })),
          dto.discount ?? 0,
        );

        const sale = manager.create(Sale, {
          organizationId: user.organizationId,
          storeId: dto.storeId,
          cashierId: user.id,
          customerId: dto.customerId ?? null,
          clientGeneratedId: dto.clientGeneratedId ?? null,
          subtotal: String(totals.subtotal),
          discount: String(totals.discount),
          tax: String(totals.tax),
          total: String(totals.total),
          paymentMethod: dto.paymentMethod,
          status: SaleStatus.COMPLETED,
          notes: dto.notes ?? null,
        });
        await manager.save(sale);

        for (let i = 0; i < resolvedItems.length; i += 1) {
          const item = resolvedItems[i];
          const line = totals.lines[i];
          await manager.save(
            manager.create(SaleItem, {
              organizationId: user.organizationId,
              saleId: sale.id,
              productId: item.product.id,
              variantId: item.variant?.id ?? null,
              productName: item.product.name,
              sku: item.variant?.sku ?? item.product.sku,
              quantity: item.quantity,
              unitPrice: String(item.unitPrice),
              purchasePrice: String(item.purchasePrice),
              taxRate: String(item.taxRate),
              discount: String(item.discount),
              total: String(line.lineTotal),
            }),
          );

          await this.stockService.adjust(manager, {
            organizationId: user.organizationId,
            storeId: dto.storeId,
            productId: item.product.id,
            variantId: item.variant?.id ?? null,
            delta: -item.quantity,
            type: StockMovementType.OUT,
            reason: `Sale ${sale.id}`,
            createdBy: user.id,
          });
        }

        const payments = dto.payments?.length
          ? dto.payments
          : [{ method: dto.paymentMethod, amount: totals.total }];

        const paymentsSum = payments.reduce((sum, p) => sum + p.amount, 0);
        if (
          dto.paymentMethod !== PaymentMethod.DEFERRED &&
          Math.abs(paymentsSum - totals.total) > 0.05
        ) {
          throw new BadRequestException('Payments do not match sale total');
        }

        for (const payment of payments) {
          await manager.save(
            manager.create(Payment, {
              organizationId: user.organizationId,
              saleId: sale.id,
              method: payment.method,
              amount: String(payment.amount),
              reference: payment.reference ?? null,
            }),
          );
        }

        if (dto.customerId) {
          const customer = await manager.findOne(Customer, {
            where: {
              id: dto.customerId,
              organizationId: user.organizationId,
            },
          });
          if (!customer) {
            throw new NotFoundException('Customer not found');
          }
          customer.totalSpent = String(
            toNumber(customer.totalSpent) + totals.total,
          );
          if (dto.paymentMethod === PaymentMethod.DEFERRED) {
            customer.debt = String(toNumber(customer.debt) + totals.total);
          }
          await manager.save(customer);
        }

        return manager.findOne(Sale, {
          where: { id: sale.id, organizationId: user.organizationId },
          relations: ['items', 'payments'],
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error) && dto.clientGeneratedId) {
        const replay = await this.salesRepo.findOne({
          where: {
            organizationId: user.organizationId,
            storeId: dto.storeId,
            clientGeneratedId: dto.clientGeneratedId,
          },
          relations: ['items', 'payments'],
        });
        if (replay) {
          return replay;
        }
      }
      throw error;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    );
  }
}
