import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity';
import { Store } from '../../stores/entities/store.entity';
import { PurchaseOrder } from '../../purchase-orders/entities/purchase-order.entity';

@Entity('suppliers')
export class Supplier extends TenantEntity {
  @Index()
  @Column({ type: 'uuid', nullable: true })
  storeId: string | null;

  @Column({ type: 'varchar', length: 180 })
  name: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => Store, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'store_id' })
  store: Store | null;

  @OneToMany(() => PurchaseOrder, (order) => order.supplier)
  purchaseOrders: PurchaseOrder[];
}
