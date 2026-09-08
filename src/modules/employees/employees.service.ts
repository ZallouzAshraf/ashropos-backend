import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource, In, Repository } from 'typeorm';
import { canManageRole } from '../../common/constants/role-permissions';
import { Role } from '../../common/enums/role.enum';
import { AuthUser } from '../../common/types/auth-user';
import { AuditService } from '../audit/audit.service';
import { OrganizationMember } from '../organizations/entities/organization-member.entity';
import { StoreMember } from '../stores/entities/store-member.entity';
import { Store } from '../stores/entities/store.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';
import { InviteEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(OrganizationMember)
    private readonly membersRepo: Repository<OrganizationMember>,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser) {
    const members = await this.membersRepo.find({
      where: { organizationId: user.organizationId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
    return members.map((member) => ({
      id: member.id,
      userId: member.userId,
      role: member.role,
      isActive: member.isActive,
      invitedAt: member.invitedAt,
      joinedAt: member.joinedAt,
      user: member.user
        ? {
            id: member.user.id,
            email: member.user.email,
            firstName: member.user.firstName,
            lastName: member.user.lastName,
            phone: member.user.phone,
            avatarColor: member.user.avatarColor,
          }
        : undefined,
    }));
  }

  async invite(actor: AuthUser, dto: InviteEmployeeDto) {
    if (!canManageRole(actor.role, dto.role)) {
      throw new ForbiddenException('Cannot assign this role');
    }

    return this.dataSource.transaction(async (manager) => {
      const email = dto.email.toLowerCase().trim();
      let user = await manager.findOne(User, { where: { email } });
      if (!user) {
        user = manager.create(User, {
          email,
          passwordHash: await bcrypt.hash(dto.password ?? 'ChangeMe123!', 12),
          firstName: dto.firstName,
          lastName: dto.lastName,
          isActive: true,
        });
        await manager.save(user);
      }

      const existing = await manager.findOne(OrganizationMember, {
        where: { organizationId: actor.organizationId, userId: user.id },
      });
      if (existing?.isActive) {
        throw new ConflictException('User is already a member');
      }

      const member =
        existing ??
        manager.create(OrganizationMember, {
          organizationId: actor.organizationId,
          userId: user.id,
        });
      member.role = dto.role;
      member.invitedAt = new Date();
      member.joinedAt = new Date();
      member.isActive = true;
      await manager.save(member);

      if (dto.storeIds?.length) {
        const stores = await manager.find(Store, {
          where: { id: In(dto.storeIds), organizationId: actor.organizationId },
        });
        if (stores.length !== dto.storeIds.length) {
          throw new NotFoundException('One or more stores were not found');
        }
        for (const store of stores) {
          await manager.save(
            manager.create(StoreMember, {
              organizationId: actor.organizationId,
              storeId: store.id,
              userId: user.id,
              isActive: true,
            }),
          );
        }
      }

      await this.audit.log({
        action: 'employee.invite',
        entityType: 'organization_member',
        entityId: member.id,
        organizationId: actor.organizationId,
        userId: actor.id,
        metadata: { role: dto.role, email },
      });

      return member;
    });
  }

  async update(actor: AuthUser, memberId: string, dto: UpdateEmployeeDto) {
    const member = await this.membersRepo.findOne({
      where: { id: memberId, organizationId: actor.organizationId },
    });
    if (!member) {
      throw new NotFoundException('Employee not found');
    }
    if (!canManageRole(actor.role, member.role)) {
      throw new ForbiddenException('Cannot manage this employee');
    }
    if (dto.role && !canManageRole(actor.role, dto.role)) {
      throw new ForbiddenException('Cannot assign this role');
    }
    if (dto.role) {
      member.role = dto.role;
    }
    if (dto.isActive !== undefined) {
      if (actor.role !== Role.OWNER) {
        throw new ForbiddenException('Only the owner can change account status');
      }
      if (member.userId === actor.id || member.role === Role.OWNER) {
        throw new ForbiddenException('The owner account cannot be disabled');
      }
      member.isActive = dto.isActive;
      if (!dto.isActive) {
        await this.dataSource.getRepository(RefreshToken).update(
          { userId: member.userId, organizationId: actor.organizationId },
          { revokedAt: new Date() },
        );
      }
    }
    await this.membersRepo.save(member);

    if (dto.storeIds) {
      await this.dataSource.transaction(async (manager) => {
        await manager.delete(StoreMember, {
          organizationId: actor.organizationId,
          userId: member.userId,
        });
        for (const storeId of dto.storeIds ?? []) {
          await manager.save(
            manager.create(StoreMember, {
              organizationId: actor.organizationId,
              storeId,
              userId: member.userId,
              isActive: true,
            }),
          );
        }
      });
    }

    return member;
  }

  async remove(actor: AuthUser, memberId: string) {
    if (actor.role !== Role.OWNER) {
      throw new ForbiddenException('Only the owner can remove a member');
    }
    const member = await this.membersRepo.findOne({
      where: { id: memberId, organizationId: actor.organizationId },
    });
    if (!member) {
      throw new NotFoundException('Employee not found');
    }
    if (member.userId === actor.id || member.role === Role.OWNER) {
      throw new ForbiddenException('The owner cannot be removed');
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(StoreMember, {
        organizationId: actor.organizationId,
        userId: member.userId,
      });
      await manager.update(
        RefreshToken,
        { userId: member.userId, organizationId: actor.organizationId },
        { revokedAt: new Date() },
      );
      await manager.delete(OrganizationMember, { id: member.id });
    });
    await this.audit.log({
      action: 'employee.remove',
      entityType: 'organization_member',
      entityId: member.id,
      organizationId: actor.organizationId,
      userId: actor.id,
      metadata: { removedUserId: member.userId },
    });
    return { success: true };
  }
}
