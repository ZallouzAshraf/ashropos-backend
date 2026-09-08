import { BadRequestException } from '@nestjs/common';
import { StockMovementType } from '../../common/enums/permission.enum';
import { StockService } from './stock.service';
import { Stock } from './entities/stock.entity';

function createLockedQuery(stock: Stock | null) {
  return {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(stock),
  };
}

describe('StockService.adjust', () => {
  const service = new StockService(
    { transaction: jest.fn() } as never,
    { find: jest.fn(), createQueryBuilder: jest.fn() } as never,
    { requireStore: jest.fn() } as never,
  );

  it('decrements stock and writes a movement', async () => {
    const stock = { quantity: 10, minThreshold: 2 } as Stock;
    const saved: unknown[] = [];
    const manager = {
      createQueryBuilder: jest.fn().mockReturnValue(createLockedQuery(stock)),
      create: jest.fn((_cls: unknown, data: unknown) => data),
      save: jest.fn(async (entity: unknown) => {
        saved.push(entity);
        return entity;
      }),
      increment: jest.fn(),
    };

    const result = await service.adjust(manager as never, {
      organizationId: 'org',
      storeId: 'store',
      productId: 'prod',
      variantId: null,
      delta: -3,
      type: StockMovementType.OUT,
      createdBy: 'user',
    });

    expect(result.quantity).toBe(7);
    expect(saved.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects an oversell', async () => {
    const stock = { quantity: 1, minThreshold: 0 } as Stock;
    const manager = {
      createQueryBuilder: jest.fn().mockReturnValue(createLockedQuery(stock)),
      create: jest.fn(),
      save: jest.fn(),
      increment: jest.fn(),
    };

    await expect(
      service.adjust(manager as never, {
        organizationId: 'org',
        storeId: 'store',
        productId: 'prod',
        variantId: null,
        delta: -2,
        type: StockMovementType.OUT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('StockService.transfer', () => {
  it('runs source decrement and target increment in one transaction', async () => {
    const requireStore = jest.fn();
    const adjust = jest
      .fn()
      .mockResolvedValueOnce({ quantity: 7 })
      .mockResolvedValueOnce({ quantity: 3 });

    const manager = {
      findOne: jest.fn(),
      create: jest.fn((_cls: unknown, data: unknown) => data),
      save: jest.fn(async (entity: unknown) => entity),
    };

    const dataSource = {
      manager: {
        findOne: jest.fn().mockResolvedValue({
          id: 'prod-a',
          name: 'Tee',
          sku: 'TEE-1',
          storeId: 'store-a',
          purchasePrice: '10',
          sellingPrice: '20',
          tax: '20',
          images: [],
        }),
      },
      transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)),
    };

    const service = new StockService(
      dataSource as never,
      {} as never,
      { requireStore } as never,
    );
    jest.spyOn(service, 'adjust').mockImplementation(adjust);
    jest
      .spyOn(service as never, 'ensureTargetCatalog')
      .mockResolvedValue({ productId: 'prod-b', variantId: null } as never);

    const user = {
      id: 'user-1',
      email: 'm@test.com',
      organizationId: 'org',
      role: 'manager',
      storeIds: [],
      membershipId: 'mem',
    };

    await service.transfer(user as never, {
      sourceStoreId: 'store-a',
      targetStoreId: 'store-b',
      productId: 'prod-a',
      quantity: 3,
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(adjust).toHaveBeenNthCalledWith(
      1,
      manager,
      expect.objectContaining({
        storeId: 'store-a',
        delta: -3,
        type: StockMovementType.TRANSFER_OUT,
      }),
    );
    expect(adjust).toHaveBeenNthCalledWith(
      2,
      manager,
      expect.objectContaining({
        storeId: 'store-b',
        delta: 3,
        type: StockMovementType.TRANSFER_IN,
      }),
    );
  });
});
