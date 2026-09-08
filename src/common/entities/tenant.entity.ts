import { Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export abstract class TenantEntity extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  organizationId: string;
}

export abstract class StoreTenantEntity extends TenantEntity {
  @Index()
  @Column({ type: 'uuid' })
  storeId: string;
}
