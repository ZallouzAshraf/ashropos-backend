import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { roleHasPermission } from '../../common/constants/role-permissions';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { Permission } from '../../common/enums/permission.enum';
import { AuthUser } from '../../common/types/auth-user';
import { TenantContext } from '../../common/context/tenant-context';
import { Stock } from '../stock/entities/stock.entity';
import { StoresService } from '../stores/stores.service';
import { CreateProductDto, ProductVariantDto, UpdateProductDto } from './dto/product.dto';
import { ProductVariant } from './entities/product-variant.entity';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Product) private readonly productsRepo: Repository<Product>,
    private readonly storesService: StoresService,
  ) {}

  async list(user: AuthUser, storeId: string, query: PaginationQueryDto) {
    await this.storesService.requireStore(user, storeId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await this.productsRepo.findAndCount({
      where: { organizationId: user.organizationId, storeId },
      relations: ['variants', 'category'],
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
    const product = await this.productsRepo.findOne({
      where: { id, organizationId: user.organizationId },
      relations: ['variants', 'category'],
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    TenantContext.assertStoreAccess(product.storeId);
    return product;
  }

  async create(user: AuthUser, dto: CreateProductDto) {
    await this.storesService.requireStore(user, dto.storeId);
    return this.dataSource.transaction(async (manager) => {
      const product = manager.create(Product, {
        organizationId: user.organizationId,
        storeId: dto.storeId,
        name: dto.name,
        sku: dto.sku ?? null,
        barcode: dto.barcode ?? null,
        categoryId: dto.categoryId ?? null,
        purchasePrice: String(dto.purchasePrice),
        sellingPrice: String(dto.sellingPrice),
        tax: String(dto.tax ?? 0),
        images: dto.images ?? [],
        supplierId: dto.supplierId ?? null,
        description: dto.description ?? null,
        isActive: true,
      });
      await manager.save(product);

      if (dto.variants?.length) {
        for (const variantDto of dto.variants) {
          await this.saveVariant(manager, user, product, variantDto);
        }
      } else {
        await manager.save(
          manager.create(Stock, {
            organizationId: user.organizationId,
            storeId: product.storeId,
            productId: product.id,
            variantId: null,
            quantity: dto.initialStock ?? 0,
            minThreshold: dto.minThreshold ?? 0,
          }),
        );
      }

      return manager.findOne(Product, {
        where: { id: product.id, organizationId: user.organizationId },
        relations: ['variants'],
      });
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateProductDto) {
    const product = await this.get(user, id);
    if (
      dto.purchasePrice !== undefined &&
      !roleHasPermission(user.role, Permission.PRODUCTS_UPDATE_PURCHASE_PRICE)
    ) {
      throw new ForbiddenException('Cannot update purchase price');
    }

    return this.dataSource.transaction(async (manager) => {
      Object.assign(product, {
        name: dto.name ?? product.name,
        sku: dto.sku ?? product.sku,
        barcode: dto.barcode ?? product.barcode,
        categoryId: dto.categoryId ?? product.categoryId,
        purchasePrice:
          dto.purchasePrice !== undefined
            ? String(dto.purchasePrice)
            : product.purchasePrice,
        sellingPrice:
          dto.sellingPrice !== undefined
            ? String(dto.sellingPrice)
            : product.sellingPrice,
        tax: dto.tax !== undefined ? String(dto.tax) : product.tax,
        images: dto.images ?? product.images,
        supplierId: dto.supplierId ?? product.supplierId,
        description: dto.description ?? product.description,
        isActive: dto.isActive ?? product.isActive,
      });
      await manager.save(product);

      if (dto.variants) {
        for (const variantDto of dto.variants) {
          await this.saveVariant(manager, user, product, variantDto);
        }
      }

      return manager.findOne(Product, {
        where: { id: product.id, organizationId: user.organizationId },
        relations: ['variants'],
      });
    });
  }

  async remove(user: AuthUser, id: string) {
    const product = await this.get(user, id);
    product.isActive = false;
    await this.productsRepo.save(product);
    return { deleted: true };
  }

  private async saveVariant(
    manager: EntityManager,
    user: AuthUser,
    product: Product,
    dto: ProductVariantDto,
  ) {
    let variant: ProductVariant | null = null;
    if (dto.id) {
      variant = await manager.findOne(ProductVariant, {
        where: {
          id: dto.id,
          productId: product.id,
          organizationId: user.organizationId,
        },
      });
      if (!variant) {
        throw new NotFoundException('Variant not found');
      }
    } else {
      variant = manager.create(ProductVariant, {
        organizationId: user.organizationId,
        storeId: product.storeId,
        productId: product.id,
      });
    }

    variant.attributes = dto.attributes;
    variant.sku = dto.sku ?? variant.sku ?? null;
    variant.barcode = dto.barcode ?? variant.barcode ?? null;
    variant.sellingPriceOverride =
      dto.sellingPriceOverride !== undefined
        ? String(dto.sellingPriceOverride)
        : variant.sellingPriceOverride;
    variant.stockQuantity = dto.stockQuantity ?? variant.stockQuantity ?? 0;
    variant.isActive = dto.isActive ?? variant.isActive ?? true;
    await manager.save(variant);

    let stock = await manager.findOne(Stock, {
      where: {
        organizationId: user.organizationId,
        storeId: product.storeId,
        productId: product.id,
        variantId: variant.id,
      },
    });
    if (!stock) {
      stock = manager.create(Stock, {
        organizationId: user.organizationId,
        storeId: product.storeId,
        productId: product.id,
        variantId: variant.id,
        quantity: dto.stockQuantity ?? 0,
        minThreshold: 0,
      });
    } else if (dto.stockQuantity !== undefined) {
      stock.quantity = dto.stockQuantity;
    }
    await manager.save(stock);
    return variant;
  }
}
