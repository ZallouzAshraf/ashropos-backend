import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { AuthUser } from '../../common/types/auth-user';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('dashboard')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('organization')
  @RequirePermissions(Permission.DASHBOARD_ORG)
  organization(@CurrentUser() user: AuthUser) {
    return this.reportsService.organizationDashboard(user);
  }

  @Get(':storeId')
  @RequirePermissions(Permission.DASHBOARD_STORE)
  store(
    @CurrentUser() user: AuthUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ) {
    return this.reportsService.storeDashboard(user, storeId);
  }
}
