import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import type { StringValue } from 'ms';
import {
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../common/enums/permission.enum';
import { Role } from '../../common/enums/role.enum';
import { slugify } from '../../common/utils/helpers';
import { AuditService } from '../audit/audit.service';
import { OrganizationMember } from '../organizations/entities/organization-member.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { Store } from '../stores/entities/store.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { AccessTokenPayload, RefreshTokenPayload } from './types/jwt-payload';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(OrganizationMember)
    private readonly membersRepo: Repository<OrganizationMember>,
    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,
  ) {}

  async register(dto: RegisterDto, ip?: string) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.usersRepo.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const result = await this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, {
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone ?? null,
        isActive: true,
      });
      await manager.save(user);

      const slug = await this.uniqueSlug(manager.getRepository(Organization), dto.organizationName);
      const organization = manager.create(Organization, {
        name: dto.organizationName,
        slug,
        subscriptionPlan: SubscriptionPlan.FREE,
        subscriptionStatus: SubscriptionStatus.TRIALING,
      });
      await manager.save(organization);

      const membership = manager.create(OrganizationMember, {
        organizationId: organization.id,
        userId: user.id,
        role: Role.OWNER,
        invitedAt: new Date(),
        joinedAt: new Date(),
        isActive: true,
      });
      await manager.save(membership);

      const store = manager.create(Store, {
        organizationId: organization.id,
        name: dto.storeName?.trim() || 'Boutique principale',
        currency: 'TND',
        timezone: 'Africa/Tunis',
        isActive: true,
      });
      await manager.save(store);

      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);
      const subscription = manager.create(Subscription, {
        organizationId: organization.id,
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.TRIALING,
        currentPeriodEnd: trialEnd,
        seatsLimit: 3,
        storesLimit: 1,
      });
      await manager.save(subscription);

      return { user, organization, membership, store };
    });

    await this.audit.log({
      action: 'auth.register',
      entityType: 'organization',
      entityId: result.organization.id,
      organizationId: result.organization.id,
      userId: result.user.id,
    });

    const tokens = await this.issueTokens(
      result.user,
      result.membership,
      ip,
    );
    return {
      user: this.publicUser(result.user),
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
      },
      store: { id: result.store.id, name: result.store.name },
      ...tokens,
    };
  }

  async login(dto: LoginDto, ip?: string) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.usersRepo.findOne({ where: { email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const memberships = await this.membersRepo.find({
      where: { userId: user.id, isActive: true },
      relations: ['organization'],
    });
    if (memberships.length === 0) {
      throw new UnauthorizedException('No active organization membership');
    }

    let membership = memberships[0];
    if (dto.organizationId) {
      const match = memberships.find((m) => m.organizationId === dto.organizationId);
      if (!match) {
        throw new UnauthorizedException('Not a member of this organization');
      }
      membership = match;
    }

    user.lastLoginAt = new Date();
    await this.usersRepo.save(user);

    const tokens = await this.issueTokens(user, membership, ip);
    return {
      user: this.publicUser(user),
      organization: {
        id: membership.organizationId,
        name: membership.organization?.name,
        role: membership.role,
      },
      organizations: memberships.map((m) => ({
        id: m.organizationId,
        name: m.organization?.name,
        role: m.role,
      })),
      ...tokens,
    };
  }

  async refresh(refreshToken: string, ip?: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshRepo.findOne({
      where: { tokenHash },
      relations: ['user'],
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (!stored.user?.isActive) {
      throw new UnauthorizedException('User is inactive');
    }

    const payload = this.jwt.verify<RefreshTokenPayload>(refreshToken, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
    if (payload.type !== 'refresh' || payload.tokenId !== stored.id) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    stored.revokedAt = new Date();
    await this.refreshRepo.save(stored);

    const membership = stored.organizationId
      ? await this.membersRepo.findOne({
          where: {
            userId: stored.userId,
            organizationId: stored.organizationId,
            isActive: true,
          },
        })
      : await this.membersRepo.findOne({
          where: { userId: stored.userId, isActive: true },
        });
    if (!membership) {
      throw new UnauthorizedException('No active organization membership');
    }

    return this.issueTokens(stored.user, membership, ip);
  }

  async switchOrganization(userId: string, organizationId: string, ip?: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId, isActive: true } });
    if (!user) {
      throw new UnauthorizedException('User is inactive');
    }
    const membership = await this.membersRepo.findOne({
      where: { userId, organizationId, isActive: true },
      relations: ['organization'],
    });
    if (!membership) {
      throw new UnauthorizedException('Not a member of this organization');
    }
    const tokens = await this.issueTokens(user, membership, ip);
    return {
      organization: {
        id: membership.organizationId,
        name: membership.organization?.name,
        role: membership.role,
      },
      ...tokens,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.refreshRepo.update({ tokenHash }, { revokedAt: new Date() });
  }

  async me(userId: string, organizationId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    const membership = await this.membersRepo.findOne({
      where: { userId, organizationId, isActive: true },
      relations: ['organization'],
    });
    return {
      user: user ? this.publicUser(user) : null,
      membership: membership
        ? {
            id: membership.id,
            role: membership.role,
            organization: {
              id: membership.organizationId,
              name: membership.organization?.name,
              slug: membership.organization?.slug,
            },
          }
        : null,
    };
  }

  private async issueTokens(
    user: User,
    membership: OrganizationMember,
    ip?: string,
  ) {
    const tokenId = randomUUID();
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      organizationId: membership.organizationId,
      role: membership.role,
      membershipId: membership.id,
      type: 'access',
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      tokenId,
      type: 'refresh',
    };

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as StringValue,
    });
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as StringValue,
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.refreshRepo.save(
      this.refreshRepo.create({
        id: tokenId,
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        organizationId: membership.organizationId,
        expiresAt,
        createdByIp: ip ?? null,
      }),
    );

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private publicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
    };
  }

  private async uniqueSlug(
    repo: Repository<Organization>,
    name: string,
  ): Promise<string> {
    const base = slugify(name) || 'org';
    let slug = base;
    let attempt = 0;
    while (await repo.exists({ where: { slug } })) {
      attempt += 1;
      slug = `${base}-${randomBytes(2).toString('hex')}`;
      if (attempt > 8) {
        slug = `${base}-${randomUUID().slice(0, 8)}`;
        break;
      }
    }
    return slug;
  }
}
