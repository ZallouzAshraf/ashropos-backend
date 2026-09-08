import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreMember } from './entities/store-member.entity';
import { Store } from './entities/store.entity';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

@Module({
  imports: [TypeOrmModule.forFeature([Store, StoreMember])],
  controllers: [StoresController],
  providers: [StoresService],
  exports: [StoresService, TypeOrmModule],
})
export class StoresModule {}
