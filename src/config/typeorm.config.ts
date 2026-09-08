import { InitialSchema1710000000000 } from '../database/migrations/1710000000000-InitialSchema';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { ALL_ENTITIES } from '../database/entities';

export const typeormConfig = (config: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: config.get<string>('DB_HOST', 'localhost'),
  port: Number(config.get('DB_PORT', 5432)),
  username: config.get<string>('DB_USER', 'ashropos'),
  password: config.get<string>('DB_PASSWORD', 'ashropos'),
  database: config.get<string>('DB_NAME', 'ashropos'),
  entities: ALL_ENTITIES,
  migrations: [InitialSchema1710000000000],
  migrationsRun: config.get<string>('NODE_ENV') !== 'test',
  synchronize: false,
  namingStrategy: new SnakeNamingStrategy(),
  logging: config.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
  extra: {
    max: 20,
  },
});
