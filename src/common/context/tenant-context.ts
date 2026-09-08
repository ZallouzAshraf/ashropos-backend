import { AsyncLocalStorage } from 'async_hooks';
import { ForbiddenException } from '@nestjs/common';
import { AuthUser, canAccessStore } from '../types/auth-user';

export const tenantAls = new AsyncLocalStorage<AuthUser>();

export class TenantContext {
  static run<T>(user: AuthUser, fn: () => T): T {
    return tenantAls.run(user, fn);
  }

  static get(): AuthUser | undefined {
    return tenantAls.getStore();
  }

  static require(): AuthUser {
    const user = tenantAls.getStore();
    if (!user) {
      throw new ForbiddenException('Tenant context is missing');
    }
    return user;
  }

  static get organizationId(): string {
    return TenantContext.require().organizationId;
  }

  static get userId(): string {
    return TenantContext.require().id;
  }

  static assertStoreAccess(storeId: string): void {
    const user = TenantContext.require();
    if (!canAccessStore(user, storeId)) {
      throw new ForbiddenException('No access to this store');
    }
  }
}
