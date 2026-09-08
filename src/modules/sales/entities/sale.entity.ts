import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { StoreTenantEntity } from '../../../common/entities/tenant.entity';
import { PaymentMethod, SaleStatus } from '../../../common/enums/permission.enum';
import { Customer } from '../../customers/entities/customer.entity';
import { Store } from '../../stores/entities/store.entity';
import { User } from '../../users/entities/user.entity';
import { Payment } from './payment.entity';
import { SaleItem } from './sale-item.entity';

@Entity('sales')
@Index(['storeId', 'clientGeneratedId'], {
  unique: true,
  where: '"client_generated_id" IS NOT NULL',
})
@Index(['organizationId', 'createdAt'])
@Index(['storeId', 'createdAt'])
export class Sale extends StoreTenantEntity {
  @Index()
  @Column({ type: 'uuid' })
  cashierId: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  customerId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  clientGeneratedId: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  subtotal: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  discount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  tax: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  total: string;

  @Column({ type: 'enum', enum: PaymentMethod, enumName: 'payment_method_enum' })
  paymentMethod: PaymentMethod;

  @Column({
    type: 'enum',
    enum: SaleStatus,
    enumName: 'sale_status_enum',
    default: SaleStatus.COMPLETED,
  })
  status: SaleStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cashier_id' })
  cashier: User;

  @ManyToOne(() => Customer, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @OneToMany(() => SaleItem, (item) => item.sale, { cascade: true })
  items: SaleItem[];

  @OneToMany(() => Payment, (payment) => payment.sale, { cascade: true })
  payments: Payment[];
}
