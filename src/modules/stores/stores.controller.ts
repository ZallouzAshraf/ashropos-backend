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
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { AuthUser } from '../../common/types/auth-user';
import { CreateStoreDto, UpdateStoreDto } from './dto/store.dto';
import { StoresService } from './stores.service';

@ApiTags('stores')
@ApiBearerAuth()
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  @RequirePermissions(Permission.STORES_READ)
  list(@CurrentUser() user: AuthUser) {
    return this.storesService.list(user);
  }

  @Get(':id')
  @RequirePermissions(Permission.STORES_READ)
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.storesService.get(user, id);
  }

  @Post()
  @RequirePermissions(Permission.STORES_MANAGE)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStoreDto) {
    return this.storesService.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.STORES_MANAGE)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.storesService.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.STORES_MANAGE)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.storesService.remove(user, id);
  }
}
