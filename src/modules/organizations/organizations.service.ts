import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { roleHasPermission } from '../../common/constants/role-permissions';
import { Permission } from '../../common/enums/permission.enum';
import { AuthUser } from '../../common/types/auth-user';
import { OrganizationMember } from './entities/organization-member.entity';
import { Organization } from './entities/organization.entity';
import { UpdateOrganizationDto } from './dto/organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly orgsRepo: Repository<Organization>,
    @InjectRepository(OrganizationMember)
    private readonly membersRepo: Repository<OrganizationMember>,
  ) {}

  async getCurrent(user: AuthUser) {
    const org = await this.orgsRepo.findOne({
      where: { id: user.organizationId },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  async updateCurrent(user: AuthUser, dto: UpdateOrganizationDto) {
    if (!roleHasPermission(user.role, Permission.ORG_MANAGE)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    const org = await this.getCurrent(user);
    if (dto.name) {
      org.name = dto.name;
    }
    return this.orgsRepo.save(org);
  }

  async listMembers(user: AuthUser) {
    return this.membersRepo.find({
      where: { organizationId: user.organizationId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }
}
