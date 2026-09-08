import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { StoreTenantEntity } from '../../../common/entities/tenant.entity';
import { Product } from './product.entity';

@Entity('product_variants')
@Index(['productId', 'sku'], { unique: true, where: '"sku" IS NOT NULL' })
export class ProductVariant extends StoreTenantEntity {
  @Index()
  @Column({ type: 'uuid' })
  productId: string;

  @Column({ type: 'jsonb', default: {} })
  attributes: Record<string, string>;

  @Column({ type: 'varchar', length: 80, nullable: true })
  sku: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  barcode: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  sellingPriceOverride: string | null;

  @Column({ type: 'int', default: 0 })
  stockQuantity: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => Product, (product) => product.variants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
