import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { StoreTenantEntity } from '../../../common/entities/tenant.entity';
import { PurchaseOrderStatus } from '../../../common/enums/permission.enum';
import { Store } from '../../stores/entities/store.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';

@Entity('purchase_orders')
export class PurchaseOrder extends StoreTenantEntity {
  @Index()
  @Column({ type: 'uuid' })
  supplierId: string;

  @Column({
    type: 'enum',
    enum: PurchaseOrderStatus,
    enumName: 'purchase_order_status_enum',
    default: PurchaseOrderStatus.DRAFT,
  })
  status: PurchaseOrderStatus;

  @Column({ type: 'date', nullable: true })
  expectedDate: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalCost: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @ManyToOne(() => Supplier, (supplier) => supplier.purchaseOrders, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @OneToMany(() => PurchaseOrderItem, (item) => item.purchaseOrder, {
    cascade: true,
  })
  items: PurchaseOrderItem[];
}
