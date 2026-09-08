import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../../common/context/tenant-context';
import { Permission } from '../../common/enums/permission.enum';
import { roleHasPermission } from '../../common/constants/role-permissions';
import { AuthUser, canAccessStore } from '../../common/types/auth-user';
import { Store } from './entities/store.entity';
import { CreateStoreDto, UpdateStoreDto } from './dto/store.dto';

@Injectable()
export class StoresService {
  constructor(
    @InjectRepository(Store) private readonly storesRepo: Repository<Store>,
  ) {}

  async list(user: AuthUser) {
    const stores = await this.storesRepo.find({
      where: { organizationId: user.organizationId },
      order: { createdAt: 'ASC' },
    });
    return stores.filter((store) => canAccessStore(user, store.id));
  }

  async get(user: AuthUser, id: string) {
    return this.requireStore(user, id);
  }

  async create(user: AuthUser, dto: CreateStoreDto) {
    this.assertPermission(user, Permission.STORES_MANAGE);
    const store = this.storesRepo.create({
      organizationId: user.organizationId,
      name: dto.name,
      address: dto.address ?? null,
      phone: dto.phone ?? null,
      currency: dto.currency ?? 'TND',
      timezone: dto.timezone ?? 'Africa/Casablanca',
      isActive: true,
    });
    return this.storesRepo.save(store);
  }

  async update(user: AuthUser, id: string, dto: UpdateStoreDto) {
    this.assertPermission(user, Permission.STORES_MANAGE);
    const store = await this.requireStore(user, id);
    Object.assign(store, dto);
    return this.storesRepo.save(store);
  }

  async remove(user: AuthUser, id: string) {
    this.assertPermission(user, Permission.STORES_MANAGE);
    const store = await this.requireStore(user, id);
    store.isActive = false;
    return this.storesRepo.save(store);
  }

  async requireStore(user: AuthUser, storeId: string): Promise<Store> {
    TenantContext.assertStoreAccess(storeId);
    const store = await this.storesRepo.findOne({
      where: { id: storeId, organizationId: user.organizationId },
    });
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    return store;
  }

  private assertPermission(user: AuthUser, permission: Permission) {
    if (!roleHasPermission(user.role, permission)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }
}
