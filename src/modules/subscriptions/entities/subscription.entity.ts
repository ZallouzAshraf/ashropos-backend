import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity';
import {
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../../common/enums/permission.enum';
import { Organization } from '../../organizations/entities/organization.entity';

@Entity('subscriptions')
export class Subscription extends TenantEntity {
  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
    enumName: 'subscription_plan_enum',
    default: SubscriptionPlan.FREE,
  })
  plan: SubscriptionPlan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    enumName: 'subscription_status_enum',
    default: SubscriptionStatus.TRIALING,
  })
  status: SubscriptionStatus;

  @Column({ type: 'timestamptz', nullable: true })
  currentPeriodEnd: Date | null;

  @Column({ type: 'int', default: 3 })
  seatsLimit: number;

  @Column({ type: 'int', default: 1 })
  storesLimit: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  stripeCustomerId: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  stripeSubscriptionId: string | null;

  @OneToOne(() => Organization, (org) => org.subscription, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
}
