import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../../common/context/tenant-context';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async log(input: {
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
    organizationId?: string;
    userId?: string | null;
  }): Promise<void> {
    const ctx = TenantContext.get();
    await this.auditRepo.save(
      this.auditRepo.create({
        organizationId: input.organizationId ?? ctx?.organizationId ?? '',
        userId: input.userId ?? ctx?.id ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata ?? {},
      }),
    );
  }
}
