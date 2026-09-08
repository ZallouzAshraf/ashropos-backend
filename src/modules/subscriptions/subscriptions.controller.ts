import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { AuthUser } from '../../common/types/auth-user';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @ApiBearerAuth()
  @Get('current')
  @RequirePermissions(Permission.SUBSCRIPTION_MANAGE)
  current(@CurrentUser() user: AuthUser) {
    return this.subscriptionsService.getCurrent(user);
  }

  @Public()
  @SkipThrottle()
  @Post('webhooks/stripe')
  webhook(
    @Headers('stripe-signature') _signature: string | undefined,
    @Body() body: { id?: string; type?: string } & Record<string, unknown>,
  ) {
    return this.subscriptionsService.handleStripeWebhook(
      String(body.id ?? ''),
      String(body.type ?? 'unknown'),
      body,
    );
  }
}
