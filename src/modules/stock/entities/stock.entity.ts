import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { StoreTenantEntity } from '../../../common/entities/tenant.entity';
import { Product } from '../../products/entities/product.entity';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { Store } from '../../stores/entities/store.entity';

@Entity('stocks')
@Index(['storeId', 'productId'])
export class Stock extends StoreTenantEntity {
  @Index()
  @Column({ type: 'uuid' })
  productId: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  variantId: string | null;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ type: 'int', default: 0 })
  minThreshold: number;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => ProductVariant, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant | null;
}
