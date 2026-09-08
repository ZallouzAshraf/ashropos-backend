import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../../common/context/tenant-context';
import { AuthUser } from '../../common/types/auth-user';
import { StoresService } from '../stores/stores.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
    private readonly storesService: StoresService,
  ) {}

  async list(user: AuthUser, storeId: string) {
    await this.storesService.requireStore(user, storeId);
    return this.categoriesRepo.find({
      where: { organizationId: user.organizationId, storeId },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async create(user: AuthUser, dto: CreateCategoryDto) {
    await this.storesService.requireStore(user, dto.storeId);
    if (dto.parentCategoryId) {
      await this.requireCategory(user, dto.parentCategoryId, dto.storeId);
    }
    const category = this.categoriesRepo.create({
      organizationId: user.organizationId,
      storeId: dto.storeId,
      name: dto.name,
      parentCategoryId: dto.parentCategoryId ?? null,
    });
    return this.categoriesRepo.save(category);
  }

  async update(user: AuthUser, id: string, dto: UpdateCategoryDto) {
    const category = await this.requireCategory(user, id);
    Object.assign(category, dto);
    return this.categoriesRepo.save(category);
  }

  async remove(user: AuthUser, id: string) {
    const category = await this.requireCategory(user, id);
    await this.categoriesRepo.update(
      { parentCategoryId: id, organizationId: user.organizationId },
      { parentCategoryId: null },
    );
    await this.categoriesRepo.remove(category);
    return { deleted: true };
  }

  async requireCategory(user: AuthUser, id: string, storeId?: string) {
    const found = await this.categoriesRepo.findOne({
      where: { id, organizationId: user.organizationId },
    });
    if (!found || (storeId && found.storeId !== storeId)) {
      throw new NotFoundException('Category not found');
    }
    TenantContext.assertStoreAccess(found.storeId);
    return found;
  }
}
