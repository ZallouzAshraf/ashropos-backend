import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { StoreTenantEntity } from '../../../common/entities/tenant.entity';
import { Role } from '../../../common/enums/role.enum';
import { User } from '../../users/entities/user.entity';
import { Store } from './store.entity';

@Entity('store_members')
@Unique(['storeId', 'userId'])
export class StoreMember extends StoreTenantEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: Role, enumName: 'role_enum', nullable: true })
  roleOverride: Role | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Store, (store) => store.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;
}
