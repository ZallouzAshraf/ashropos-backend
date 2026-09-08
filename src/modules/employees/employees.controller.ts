import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { AuthUser } from '../../common/types/auth-user';
import { InviteEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
import { EmployeesService } from './employees.service';

@ApiTags('employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @RequirePermissions(Permission.EMPLOYEES_READ)
  list(@CurrentUser() user: AuthUser) {
    return this.employeesService.list(user);
  }

  @Post()
  @RequirePermissions(Permission.EMPLOYEES_MANAGE)
  invite(@CurrentUser() user: AuthUser, @Body() dto: InviteEmployeeDto) {
    return this.employeesService.invite(user, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.EMPLOYEES_MANAGE)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.EMPLOYEES_MANAGE)
  deactivate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employeesService.deactivate(user, id);
  }
}
