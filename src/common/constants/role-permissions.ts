import { Permission } from '../enums/permission.enum';
import { Role } from '../enums/role.enum';

const MANAGER_PERMISSIONS: Permission[] = [
  Permission.PRODUCTS_READ,
  Permission.PRODUCTS_CREATE,
  Permission.PRODUCTS_UPDATE,
  Permission.PRODUCTS_DELETE,
  Permission.PRODUCTS_UPDATE_PURCHASE_PRICE,
  Permission.CATEGORIES_MANAGE,
  Permission.STOCK_READ,
  Permission.STOCK_MOVEMENT,
  Permission.STOCK_TRANSFER,
  Permission.SALES_CREATE,
  Permission.SALES_READ,
  Permission.SALES_UPDATE,
  Permission.CUSTOMERS_READ,
  Permission.CUSTOMERS_MANAGE,
  Permission.SUPPLIERS_READ,
  Permission.SUPPLIERS_MANAGE,
  Permission.EMPLOYEES_READ,
  Permission.EMPLOYEES_MANAGE,
  Permission.STORES_READ,
  Permission.DASHBOARD_STORE,
  Permission.DASHBOARD_ORG,
  Permission.REPORTS_READ,
  Permission.PURCHASE_ORDERS_READ,
  Permission.PURCHASE_ORDERS_MANAGE,
];

const CASHIER_PERMISSIONS: Permission[] = [
  Permission.PRODUCTS_READ,
  Permission.STOCK_READ,
  Permission.SALES_CREATE,
  Permission.SALES_READ,
  Permission.CUSTOMERS_READ,
  Permission.DASHBOARD_STORE,
];

const ACCOUNTANT_PERMISSIONS: Permission[] = [
  Permission.PRODUCTS_READ,
  Permission.STOCK_READ,
  Permission.SALES_READ,
  Permission.CUSTOMERS_READ,
  Permission.DASHBOARD_STORE,
  Permission.DASHBOARD_ORG,
  Permission.REPORTS_READ,
  Permission.PURCHASE_ORDERS_READ,
];

export const ROLE_PERMISSIONS: Record<Role, Permission[] | ['*']> = {
  [Role.OWNER]: ['*'],
  [Role.ADMIN]: ['*'],
  [Role.MANAGER]: MANAGER_PERMISSIONS,
  [Role.CASHIER]: CASHIER_PERMISSIONS,
  [Role.ACCOUNTANT]: ACCOUNTANT_PERMISSIONS,
};

export function getPermissionsForRole(role: Role): Permission[] | ['*'] {
  return ROLE_PERMISSIONS[role];
}

export function roleHasPermission(role: Role, permission: Permission): boolean {
  const granted = ROLE_PERMISSIONS[role];
  if (granted.length === 1 && granted[0] === '*') {
    return true;
  }
  return (granted as Permission[]).includes(permission);
}

export function roleHasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((permission) => roleHasPermission(role, permission));
}

/**
 * Who can manage whom:
 * - Owner: everyone
 * - Admin: everyone except Owner (and not other Admins' ownership)
 * - Manager: Cashier and Accountant only (cannot touch Owner/Admin)
 */
export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === Role.OWNER) {
    return true;
  }
  if (actorRole === Role.ADMIN) {
    return targetRole !== Role.OWNER;
  }
  if (actorRole === Role.MANAGER) {
    return targetRole === Role.CASHIER || targetRole === Role.ACCOUNTANT;
  }
  return false;
}

export function isPrivilegedRole(role: Role): boolean {
  return role === Role.OWNER || role === Role.ADMIN;
}
