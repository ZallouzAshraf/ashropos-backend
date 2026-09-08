import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity';
import { PaymentMethod } from '../../../common/enums/permission.enum';
import { Sale } from './sale.entity';

@Entity('payments')
export class Payment extends TenantEntity {
  @Index()
  @Column({ type: 'uuid' })
  saleId: string;

  @Column({ type: 'enum', enum: PaymentMethod, enumName: 'payment_method_enum' })
  method: PaymentMethod;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  reference: string | null;

  @ManyToOne(() => Sale, (sale) => sale.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;
}
