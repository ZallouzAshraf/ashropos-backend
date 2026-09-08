import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { StorePaginationQueryDto } from '../../common/dto/pagination.dto';
import { Permission } from '../../common/enums/permission.enum';
import { AuthUser } from '../../common/types/auth-user';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions(Permission.PRODUCTS_READ)
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: StorePaginationQueryDto,
  ) {
    return this.productsService.list(user, query.storeId, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.PRODUCTS_READ)
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.get(user, id);
  }

  @Post()
  @RequirePermissions(Permission.PRODUCTS_CREATE)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return this.productsService.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.PRODUCTS_UPDATE)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.PRODUCTS_DELETE)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(user, id);
  }
}
