import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { StoreTenantEntity } from '../../../common/entities/tenant.entity';
import { Category } from '../../categories/entities/category.entity';
import { Store } from '../../stores/entities/store.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { ProductVariant } from './product-variant.entity';

@Entity('products')
@Index(['storeId', 'sku'], { unique: true, where: '"sku" IS NOT NULL' })
@Index(['storeId', 'barcode'], { unique: true, where: '"barcode" IS NOT NULL' })
export class Product extends StoreTenantEntity {
  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  sku: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  barcode: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  purchasePrice: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  sellingPrice: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  tax: string;

  @Column({ type: 'jsonb', default: [] })
  images: string[];

  @Index()
  @Column({ type: 'uuid', nullable: true })
  supplierId: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @ManyToOne(() => Category, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @ManyToOne(() => Supplier, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier | null;

  @OneToMany(() => ProductVariant, (variant) => variant.product, {
    cascade: true,
  })
  variants: ProductVariant[];
}
