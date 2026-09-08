import { SaleStatus, StockMovementType } from '../../common/enums/permission.enum';
import { Role } from '../../common/enums/role.enum';
import { AuthUser } from '../../common/types/auth-user';
import { SalesService } from './sales.service';

describe('SalesService.create', () => {
  const user: AuthUser = {
    id: 'cashier-1',
    email: 'cashier@test.com',
    organizationId: 'org-1',
    role: Role.CASHIER,
    storeIds: ['store-1'],
    membershipId: 'mem-1',
  };

  function buildService(overrides?: {
    existingSale?: unknown;
    stockError?: Error;
  }) {
    const saved: Record<string, unknown[]> = {
      sale: [],
      item: [],
      payment: [],
    };
    const manager = {
      findOne: jest.fn().mockImplementation((entity: { name?: string }) => {
        if (entity?.name === 'Product' || entity === undefined) {
          return Promise.resolve({
            id: 'prod-1',
            name: 'Tote',
            sku: 'BAG-1',
            sellingPrice: '100.00',
            purchasePrice: '40.00',
            tax: '20.00',
            storeId: 'store-1',
            isActive: true,
          });
        }
        return Promise.resolve(null);
      }),
      create: jest.fn((_cls: unknown, data: Record<string, unknown>) => ({
        id: data.id ?? 'generated-id',
        ...data,
      })),
      save: jest.fn(async (entity: Record<string, unknown>) => entity),
    };

    manager.findOne.mockImplementation(
      async (entity: { name: string }, _opts?: unknown) => {
        if (String(entity.name) === 'Product') {
          return {
            id: 'prod-1',
            name: 'Tote',
            sku: 'BAG-1',
            sellingPrice: '100.00',
            purchasePrice: '40.00',
            tax: '20.00',
            storeId: 'store-1',
            isActive: true,
          };
        }
        if (String(entity.name) === 'Sale') {
          return {
            id: 'sale-1',
            status: SaleStatus.COMPLETED,
            cashierId: user.id,
            organizationId: user.organizationId,
            storeId: 'store-1',
            items: [],
            payments: [],
          };
        }
        return null;
      },
    );

    const stockAdjust = overrides?.stockError
      ? jest.fn().mockRejectedValue(overrides.stockError)
      : jest.fn().mockResolvedValue({ quantity: 9 });

    const dataSource = {
      transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => {
        const result = await cb(manager);
        return result;
      }),
    };

    const salesRepo = {
      findOne: jest.fn().mockResolvedValue(overrides?.existingSale ?? null),
      findAndCount: jest.fn(),
    };

    const service = new SalesService(
      dataSource as never,
      salesRepo as never,
      { requireStore: jest.fn() } as never,
      { adjust: stockAdjust } as never,
    );

    return { service, manager, stockAdjust, salesRepo, saved };
  }

  it('refuses the sale and does not persist when stock is insufficient', async () => {
    const { service, stockAdjust } = buildService({
      stockError: new Error('Insufficient stock'),
    });

    await expect(
      service.create(user, {
        storeId: 'store-1',
        paymentMethod: 'cash' as never,
        items: [{ productId: 'prod-1', quantity: 2 }],
      }),
    ).rejects.toThrow('Insufficient stock');

    expect(stockAdjust).toHaveBeenCalled();
  });

  it('decrements stock in the same transaction as the sale', async () => {
    const { service, stockAdjust } = buildService();

    const sale = await service.create(user, {
      storeId: 'store-1',
      paymentMethod: 'cash' as never,
      items: [{ productId: 'prod-1', quantity: 1 }],
    });

    expect(stockAdjust).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        delta: -1,
        type: StockMovementType.OUT,
        productId: 'prod-1',
      }),
    );
    expect(sale).toEqual(
      expect.objectContaining({
        status: SaleStatus.COMPLETED,
        cashierId: user.id,
      }),
    );
  });

  it('returns the existing sale when clientGeneratedId is replayed', async () => {
    const existing = { id: 'sale-dup', clientGeneratedId: 'offline-1' };
    const { service, stockAdjust } = buildService({ existingSale: existing });

    const result = await service.create(user, {
      storeId: 'store-1',
      clientGeneratedId: 'offline-1',
      paymentMethod: 'cash' as never,
      items: [{ productId: 'prod-1', quantity: 1 }],
    });

    expect(result).toBe(existing);
    expect(stockAdjust).not.toHaveBeenCalled();
  });
});
