import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity';
import { Role } from '../../../common/enums/role.enum';
import { User } from '../../users/entities/user.entity';
import { Organization } from './organization.entity';

@Entity('organization_members')
@Unique(['organizationId', 'userId'])
export class OrganizationMember extends TenantEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: Role, enumName: 'role_enum' })
  role: Role;

  @Column({ type: 'timestamptz', nullable: true })
  invitedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  joinedAt: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => User, (user) => user.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Organization, (org) => org.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
}
