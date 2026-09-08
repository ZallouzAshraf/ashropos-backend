import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/types/auth-user';
import { StoresService } from '../stores/stores.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { Customer } from './entities/customer.entity';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customersRepo: Repository<Customer>,
    private readonly storesService: StoresService,
  ) {}

  async list(user: AuthUser, query: PaginationQueryDto, storeId?: string) {
    if (storeId) {
      await this.storesService.requireStore(user, storeId);
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await this.customersRepo.findAndCount({
      where: {
        organizationId: user.organizationId,
        ...(storeId ? { storeId } : {}),
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(user: AuthUser, dto: CreateCustomerDto) {
    if (dto.storeId) {
      await this.storesService.requireStore(user, dto.storeId);
    }
    const customer = this.customersRepo.create({
      organizationId: user.organizationId,
      storeId: dto.storeId ?? null,
      name: dto.name,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      notes: dto.notes ?? null,
    });
    return this.customersRepo.save(customer);
  }

  async update(user: AuthUser, id: string, dto: UpdateCustomerDto) {
    const customer = await this.require(user, id);
    Object.assign(customer, dto);
    if (dto.debt !== undefined) {
      customer.debt = String(dto.debt);
    }
    return this.customersRepo.save(customer);
  }

  async require(user: AuthUser, id: string) {
    const customer = await this.customersRepo.findOne({
      where: { id, organizationId: user.organizationId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }
}
