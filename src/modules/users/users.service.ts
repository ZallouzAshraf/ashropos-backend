import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../../common/types/auth-user';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
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
      lastLoginAt: entity.lastLoginAt,
    };
  }
}
