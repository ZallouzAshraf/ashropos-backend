import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { IsNull, Repository } from 'typeorm';
import { AuthUser } from '../../common/types/auth-user';
import { ChangePasswordDto, UpdateProfileDto } from './dto/user.dto';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,
  ) {}

  async me(user: AuthUser) {
    const entity = await this.usersRepo.findOne({ where: { id: user.id } });
    if (!entity) {
      return null;
    }
    return {
      id: entity.id,
      email: entity.email,
      firstName: entity.firstName,
      lastName: entity.lastName,
      phone: entity.phone,
      avatarColor: entity.avatarColor,
      lastLoginAt: entity.lastLoginAt,
    };
  }

  async updateProfile(user: AuthUser, dto: UpdateProfileDto) {
    const entity = await this.usersRepo.findOne({ where: { id: user.id } });
    if (!entity) {
      throw new NotFoundException('User not found');
    }
    if (dto.email && dto.email.toLowerCase().trim() !== entity.email) {
      const email = dto.email.toLowerCase().trim();
      if (await this.usersRepo.exists({ where: { email } })) {
        throw new ConflictException('Email already in use');
      }
      entity.email = email;
    }
    if (dto.firstName !== undefined) entity.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) entity.lastName = dto.lastName.trim();
    if (dto.phone !== undefined) entity.phone = dto.phone.trim() || null;
    if (dto.avatarColor !== undefined) entity.avatarColor = dto.avatarColor.toUpperCase();
    await this.usersRepo.save(entity);
    return this.me(user);
  }

  async changePassword(user: AuthUser, dto: ChangePasswordDto) {
    const entity = await this.usersRepo.findOne({ where: { id: user.id } });
    if (!entity) {
      throw new NotFoundException('User not found');
    }
    if (!(await bcrypt.compare(dto.currentPassword, entity.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    entity.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.usersRepo.save(entity);
    await this.refreshRepo.update(
      { userId: user.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return { success: true };
  }
}
