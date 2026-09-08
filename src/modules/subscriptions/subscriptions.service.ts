import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../../common/types/auth-user';
import { StripeWebhookEvent } from './entities/stripe-webhook-event.entity';
import { Subscription } from './entities/subscription.entity';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionsRepo: Repository<Subscription>,
    @InjectRepository(StripeWebhookEvent)
    private readonly eventsRepo: Repository<StripeWebhookEvent>,
  ) {}

  async getCurrent(user: AuthUser) {
    const subscription = await this.subscriptionsRepo.findOne({
      where: { organizationId: user.organizationId },
    });
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    return subscription;
  }

  async handleStripeWebhook(eventId: string, type: string, payload: Record<string, unknown>) {
    const existing = await this.eventsRepo.findOne({
      where: { stripeEventId: eventId },
    });
    if (existing?.processed) {
      return { received: true, duplicate: true };
    }

    const event =
      existing ??
      this.eventsRepo.create({
        stripeEventId: eventId,
        type,
        payload,
        processed: false,
        organizationId: null,
      });
    await this.eventsRepo.save(event);

    const object = (payload.data as { object?: Record<string, unknown> } | undefined)?.object;
    const stripeSubscriptionId =
      typeof object?.id === 'string' ? object.id : undefined;
    const stripeCustomerId =
      typeof object?.customer === 'string' ? object.customer : undefined;

    if (stripeSubscriptionId || stripeCustomerId) {
      const subscription = await this.subscriptionsRepo.findOne({
        where: stripeSubscriptionId
          ? { stripeSubscriptionId }
          : { stripeCustomerId },
      });
      if (subscription) {
        if (type === 'customer.subscription.deleted') {
          subscription.status = subscription.status;
        }
        event.organizationId = subscription.organizationId;
      }
    }

    event.processed = true;
    await this.eventsRepo.save(event);
    return { received: true, duplicate: false };
  }
}
