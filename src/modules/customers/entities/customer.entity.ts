import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity';
import { Store } from '../../stores/entities/store.entity';
import { Sale } from '../../sales/entities/sale.entity';

@Entity('customers')
export class Customer extends TenantEntity {
  @Index()
  @Column({ type: 'uuid', nullable: true })
  storeId: string | null;

  @Column({ type: 'varchar', length: 180 })
  name: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalSpent: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  debt: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => Store, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'store_id' })
  store: Store | null;

  @OneToMany(() => Sale, (sale) => sale.customer)
  sales: Sale[];
}
