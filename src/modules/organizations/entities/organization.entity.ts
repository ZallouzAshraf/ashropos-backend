import { Column, Entity, Index, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SubscriptionPlan, SubscriptionStatus } from '../../../common/enums/permission.enum';
import { OrganizationMember } from './organization-member.entity';
import { Store } from '../../stores/entities/store.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';

@Entity('organizations')
export class Organization extends BaseEntity {
  @Column({ type: 'varchar', length: 180 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  slug: string;

  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
    enumName: 'subscription_plan_enum',
    default: SubscriptionPlan.FREE,
  })
  subscriptionPlan: SubscriptionPlan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    enumName: 'subscription_status_enum',
    default: SubscriptionStatus.TRIALING,
  })
  subscriptionStatus: SubscriptionStatus;

  @OneToMany(() => OrganizationMember, (member) => member.organization)
  members: OrganizationMember[];

  @OneToMany(() => Store, (store) => store.organization)
  stores: Store[];

  @OneToOne(() => Subscription, (subscription) => subscription.organization)
  subscription: Subscription;
}
