import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('stripe_webhook_events')
export class StripeWebhookEvent extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', nullable: true })
  organizationId: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  stripeEventId: string;

  @Column({ type: 'varchar', length: 120 })
  type: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'boolean', default: false })
  processed: boolean;
}
