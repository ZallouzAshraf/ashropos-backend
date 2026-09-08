import { Permission } from '../enums/permission.enum';
import { Role } from '../enums/role.enum';
import {
  canManageRole,
  roleHasPermission,
} from './role-permissions';

describe('role permissions', () => {
  it('gives owner and admin full access', () => {
    expect(roleHasPermission(Role.OWNER, Permission.SALES_DELETE)).toBe(true);
    expect(roleHasPermission(Role.ADMIN, Permission.SUBSCRIPTION_MANAGE)).toBe(
      true,
    );
  });

  it('prevents a cashier from deleting sales, managing employees or purchase prices', () => {
    expect(roleHasPermission(Role.CASHIER, Permission.SALES_CREATE)).toBe(true);
    expect(roleHasPermission(Role.CASHIER, Permission.SALES_DELETE)).toBe(false);
    expect(roleHasPermission(Role.CASHIER, Permission.EMPLOYEES_MANAGE)).toBe(
      false,
    );
    expect(
      roleHasPermission(Role.CASHIER, Permission.PRODUCTS_UPDATE_PURCHASE_PRICE),
    ).toBe(false);
  });

  it('lets a manager manage catalog, stock and cashiers but not owners', () => {
    expect(roleHasPermission(Role.MANAGER, Permission.STOCK_TRANSFER)).toBe(
      true,
    );
    expect(roleHasPermission(Role.MANAGER, Permission.EMPLOYEES_MANAGE)).toBe(
      true,
    );
    expect(canManageRole(Role.MANAGER, Role.CASHIER)).toBe(true);
    expect(canManageRole(Role.MANAGER, Role.OWNER)).toBe(false);
    expect(canManageRole(Role.MANAGER, Role.ADMIN)).toBe(false);
    expect(canManageRole(Role.ADMIN, Role.OWNER)).toBe(false);
    expect(canManageRole(Role.OWNER, Role.ADMIN)).toBe(true);
  });

  it('limits accountant to read/report permissions', () => {
    expect(roleHasPermission(Role.ACCOUNTANT, Permission.SALES_READ)).toBe(true);
    expect(roleHasPermission(Role.ACCOUNTANT, Permission.SALES_CREATE)).toBe(
      false,
    );
    expect(roleHasPermission(Role.ACCOUNTANT, Permission.DASHBOARD_ORG)).toBe(
      true,
    );
  });
});
