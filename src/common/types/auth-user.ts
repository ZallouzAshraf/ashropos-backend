import { Role } from '../enums/role.enum';

export interface AuthUser {
  id: string;
  email: string;
  organizationId: string;
  role: Role;
  storeIds: string[];
  membershipId: string;
}

export function canAccessAllStores(user: AuthUser): boolean {
  return user.role === Role.OWNER || user.role === Role.ADMIN;
}

export function canAccessStore(user: AuthUser, storeId: string): boolean {
  if (canAccessAllStores(user)) {
    return true;
  }
  if (user.storeIds.length === 0) {
    return true;
  }
  return user.storeIds.includes(storeId);
}
