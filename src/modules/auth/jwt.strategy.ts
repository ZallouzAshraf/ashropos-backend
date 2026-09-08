import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { AuthUser } from '../../common/types/auth-user';
import { OrganizationMember } from '../organizations/entities/organization-member.entity';
import { StoreMember } from '../stores/entities/store-member.entity';
import { User } from '../users/entities/user.entity';
import { AccessTokenPayload } from './types/jwt-payload';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(OrganizationMember)
    private readonly membersRepo: Repository<OrganizationMember>,
    @InjectRepository(StoreMember)
    private readonly storeMembersRepo: Repository<StoreMember>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.usersRepo.findOne({
      where: { id: payload.sub, isActive: true },
    });
    if (!user) {
      throw new UnauthorizedException('User is inactive or missing');
    }

    const membership = await this.membersRepo.findOne({
      where: {
        id: payload.membershipId,
        userId: user.id,
        organizationId: payload.organizationId,
        isActive: true,
      },
    });
    if (!membership) {
      throw new UnauthorizedException('Organization membership is inactive');
    }

    const storeMembers = await this.storeMembersRepo.find({
      where: {
        userId: user.id,
        organizationId: membership.organizationId,
        isActive: true,
      },
    });

    return {
      id: user.id,
      email: user.email,
      organizationId: membership.organizationId,
      role: membership.role,
      storeIds: storeMembers.map((member) => member.storeId),
      membershipId: membership.id,
    };
  }
}
