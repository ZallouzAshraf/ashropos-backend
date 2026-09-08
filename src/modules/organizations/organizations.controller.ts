import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { AuthUser } from '../../common/types/auth-user';
import { UpdateOrganizationDto } from './dto/organization.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('current')
  getCurrent(@CurrentUser() user: AuthUser) {
    return this.organizationsService.getCurrent(user);
  }

  @Patch('current')
  @RequirePermissions(Permission.ORG_MANAGE)
  updateCurrent(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.updateCurrent(user, dto);
  }

  @Get('members')
  @RequirePermissions(Permission.EMPLOYEES_READ)
  listMembers(@CurrentUser() user: AuthUser) {
    return this.organizationsService.listMembers(user);
  }
}
