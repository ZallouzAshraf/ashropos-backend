import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { StoreTenantEntity } from '../../../common/entities/tenant.entity';
import { Store } from '../../stores/entities/store.entity';

@Entity('categories')
export class Category extends StoreTenantEntity {
  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  parentCategoryId: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @ManyToOne(() => Category, (category) => category.children, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'parent_category_id' })
  parent: Category | null;

  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];
}
