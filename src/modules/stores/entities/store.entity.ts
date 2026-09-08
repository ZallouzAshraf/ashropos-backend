import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { StoreMember } from './store-member.entity';

@Entity('stores')
export class Store extends TenantEntity {
  @Column({ type: 'varchar', length: 180 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 3, default: 'TND' })
  currency: string;

  @Column({ type: 'varchar', length: 64, default: 'Africa/Casablanca' })
  timezone: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => Organization, (org) => org.stores, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @OneToMany(() => StoreMember, (member) => member.store)
  members: StoreMember[];
}
