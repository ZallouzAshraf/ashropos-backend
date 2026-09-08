import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../../common/types/auth-user';
import { StoresService } from '../stores/stores.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { Supplier } from './entities/supplier.entity';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly suppliersRepo: Repository<Supplier>,
    private readonly storesService: StoresService,
  ) {}

  async list(user: AuthUser, storeId?: string) {
    if (storeId) {
      await this.storesService.requireStore(user, storeId);
    }
    return this.suppliersRepo.find({
      where: {
        organizationId: user.organizationId,
        ...(storeId ? { storeId } : {}),
      },
      order: { name: 'ASC' },
    });
  }

  async create(user: AuthUser, dto: CreateSupplierDto) {
    if (dto.storeId) {
      await this.storesService.requireStore(user, dto.storeId);
    }
    return this.suppliersRepo.save(
      this.suppliersRepo.create({
        organizationId: user.organizationId,
        storeId: dto.storeId ?? null,
        name: dto.name,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        address: dto.address ?? null,
      }),
    );
  }

  async update(user: AuthUser, id: string, dto: UpdateSupplierDto) {
    const supplier = await this.suppliersRepo.findOne({
      where: { id, organizationId: user.organizationId },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
    Object.assign(supplier, dto);
    return this.suppliersRepo.save(supplier);
  }
}
