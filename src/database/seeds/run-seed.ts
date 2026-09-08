import 'reflect-metadata';
import { config } from 'dotenv';
import * as bcrypt from 'bcryptjs';
import dataSource from '../data-source';
import { Role } from '../../common/enums/role.enum';
import {
  PaymentMethod,
  SaleStatus,
  StockMovementType,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../common/enums/permission.enum';
import { User } from '../../modules/users/entities/user.entity';
import { Organization } from '../../modules/organizations/entities/organization.entity';
import { OrganizationMember } from '../../modules/organizations/entities/organization-member.entity';
import { Store } from '../../modules/stores/entities/store.entity';
import { StoreMember } from '../../modules/stores/entities/store-member.entity';
import { Subscription } from '../../modules/subscriptions/entities/subscription.entity';
import { Category } from '../../modules/categories/entities/category.entity';
import { Product } from '../../modules/products/entities/product.entity';
import { ProductVariant } from '../../modules/products/entities/product-variant.entity';
import { Stock } from '../../modules/stock/entities/stock.entity';
import { StockMovement } from '../../modules/stock/entities/stock-movement.entity';
import { Customer } from '../../modules/customers/entities/customer.entity';
import { Supplier } from '../../modules/suppliers/entities/supplier.entity';
import { Sale } from '../../modules/sales/entities/sale.entity';
import { SaleItem } from '../../modules/sales/entities/sale-item.entity';
import { Payment } from '../../modules/sales/entities/payment.entity';

config();

const DEMO_PASSWORD = 'Demo123!';

async function seed() {
  await dataSource.initialize();
  const qr = dataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    const existing = await qr.manager.findOne(Organization, {
      where: { slug: 'ashro-demo' },
    });
    if (existing) {
      console.log('Demo organization already exists, skipping seed.');
      await qr.commitTransaction();
      return;
    }

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    const organization = await qr.manager.save(
      qr.manager.create(Organization, {
        name: 'Ashro Demo',
        slug: 'ashro-demo',
        subscriptionPlan: SubscriptionPlan.STARTER,
        subscriptionStatus: SubscriptionStatus.TRIALING,
      }),
    );

    await qr.manager.save(
      qr.manager.create(Subscription, {
        organizationId: organization.id,
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.TRIALING,
        currentPeriodEnd: trialEnd,
        seatsLimit: 10,
        storesLimit: 5,
      }),
    );

    const centre = await qr.manager.save(
      qr.manager.create(Store, {
        organizationId: organization.id,
        name: 'Boutique Centre',
        address: '12 Avenue Hassan II, Casablanca',
        phone: '+212522000001',
        currency: 'TND',
        timezone: 'Africa/Tunis',
      }),
    );
    const marina = await qr.manager.save(
      qr.manager.create(Store, {
        organizationId: organization.id,
        name: 'Boutique Marina',
        address: 'Marina Shopping, Casablanca',
        phone: '+212522000002',
        currency: 'TND',
        timezone: 'Africa/Tunis',
      }),
    );

    const profiles: Array<{
      email: string;
      firstName: string;
      lastName: string;
      role: Role;
      storeIds: string[];
    }> = [
      {
        email: 'owner@ashropos.demo',
        firstName: 'Amina',
        lastName: 'El Fassi',
        role: Role.OWNER,
        storeIds: [],
      },
      {
        email: 'admin@ashropos.demo',
        firstName: 'Youssef',
        lastName: 'Benali',
        role: Role.ADMIN,
        storeIds: [],
      },
      {
        email: 'manager@ashropos.demo',
        firstName: 'Sara',
        lastName: 'Idrissi',
        role: Role.MANAGER,
        storeIds: [centre.id, marina.id],
      },
      {
        email: 'cashier@ashropos.demo',
        firstName: 'Karim',
        lastName: 'Tazi',
        role: Role.CASHIER,
        storeIds: [centre.id],
      },
      {
        email: 'accountant@ashropos.demo',
        firstName: 'Nadia',
        lastName: 'Amrani',
        role: Role.ACCOUNTANT,
        storeIds: [],
      },
    ];

    const users: Record<string, User> = {};
    for (const profile of profiles) {
      const user = await qr.manager.save(
        qr.manager.create(User, {
          email: profile.email,
          passwordHash,
          firstName: profile.firstName,
          lastName: profile.lastName,
          isActive: true,
        }),
      );
      users[profile.role] = user;
      await qr.manager.save(
        qr.manager.create(OrganizationMember, {
          organizationId: organization.id,
          userId: user.id,
          role: profile.role,
          invitedAt: new Date(),
          joinedAt: new Date(),
          isActive: true,
        }),
      );
      for (const storeId of profile.storeIds) {
        await qr.manager.save(
          qr.manager.create(StoreMember, {
            organizationId: organization.id,
            storeId,
            userId: user.id,
            isActive: true,
          }),
        );
      }
    }

    const supplier = await qr.manager.save(
      qr.manager.create(Supplier, {
        organizationId: organization.id,
        name: 'Textile Atlas',
        phone: '+212522111222',
        email: 'contact@textile-atlas.ma',
        address: 'Zone industrielle Ain Sebaa',
      }),
    );

    const customer = await qr.manager.save(
      qr.manager.create(Customer, {
        organizationId: organization.id,
        storeId: centre.id,
        name: 'Client Passage',
        phone: '+212661000111',
        email: 'client@demo.ma',
      }),
    );

    async function seedStoreCatalog(store: Store) {
      const clothing = await qr.manager.save(
        qr.manager.create(Category, {
          organizationId: organization.id,
          storeId: store.id,
          name: 'Vêtements',
        }),
      );
      const accessories = await qr.manager.save(
        qr.manager.create(Category, {
          organizationId: organization.id,
          storeId: store.id,
          name: 'Accessoires',
        }),
      );

      const tee = await qr.manager.save(
        qr.manager.create(Product, {
          organizationId: organization.id,
          storeId: store.id,
          name: 'T-shirt Essential',
          sku: `TEE-${store.name.includes('Centre') ? 'CTR' : 'MAR'}`,
          barcode: store.id.slice(0, 8),
          categoryId: clothing.id,
          purchasePrice: '80.00',
          sellingPrice: '149.00',
          tax: '20.00',
          images: [],
          supplierId: supplier.id,
          isActive: true,
        }),
      );

      const blackM = await qr.manager.save(
        qr.manager.create(ProductVariant, {
          organizationId: organization.id,
          storeId: store.id,
          productId: tee.id,
          attributes: { couleur: 'Noir', taille: 'M' },
          sku: `${tee.sku}-BLK-M`,
          sellingPriceOverride: '149.00',
          stockQuantity: 25,
        }),
      );
      const whiteL = await qr.manager.save(
        qr.manager.create(ProductVariant, {
          organizationId: organization.id,
          storeId: store.id,
          productId: tee.id,
          attributes: { couleur: 'Blanc', taille: 'L' },
          sku: `${tee.sku}-WHT-L`,
          sellingPriceOverride: '149.00',
          stockQuantity: 18,
        }),
      );

      const bag = await qr.manager.save(
        qr.manager.create(Product, {
          organizationId: organization.id,
          storeId: store.id,
          name: 'Tote Bag Coton',
          sku: `BAG-${store.name.includes('Centre') ? 'CTR' : 'MAR'}`,
          categoryId: accessories.id,
          purchasePrice: '35.00',
          sellingPrice: '89.00',
          tax: '20.00',
          images: [],
          supplierId: supplier.id,
          isActive: true,
        }),
      );

      await qr.manager.save(
        qr.manager.create(Stock, {
          organizationId: organization.id,
          storeId: store.id,
          productId: tee.id,
          variantId: blackM.id,
          quantity: 25,
          minThreshold: 5,
        }),
      );
      await qr.manager.save(
        qr.manager.create(Stock, {
          organizationId: organization.id,
          storeId: store.id,
          productId: tee.id,
          variantId: whiteL.id,
          quantity: 18,
          minThreshold: 5,
        }),
      );
      await qr.manager.save(
        qr.manager.create(Stock, {
          organizationId: organization.id,
          storeId: store.id,
          productId: bag.id,
          variantId: null,
          quantity: 40,
          minThreshold: 8,
        }),
      );

      return { tee, blackM, whiteL, bag };
    }

    const centreCatalog = await seedStoreCatalog(centre);
    await seedStoreCatalog(marina);

    const sale = await qr.manager.save(
      qr.manager.create(Sale, {
        organizationId: organization.id,
        storeId: centre.id,
        cashierId: users[Role.CASHIER].id,
        customerId: customer.id,
        clientGeneratedId: 'seed-sale-001',
        subtotal: '298.00',
        discount: '0.00',
        tax: '59.60',
        total: '357.60',
        paymentMethod: PaymentMethod.CASH,
        status: SaleStatus.COMPLETED,
      }),
    );
    await qr.manager.save(
      qr.manager.create(SaleItem, {
        organizationId: organization.id,
        saleId: sale.id,
        productId: centreCatalog.tee.id,
        variantId: centreCatalog.blackM.id,
        productName: 'T-shirt Essential',
        sku: centreCatalog.blackM.sku,
        quantity: 2,
        unitPrice: '149.00',
        purchasePrice: '80.00',
        taxRate: '20.00',
        discount: '0.00',
        total: '357.60',
      }),
    );
    await qr.manager.save(
      qr.manager.create(Payment, {
        organizationId: organization.id,
        saleId: sale.id,
        method: PaymentMethod.CASH,
        amount: '357.60',
      }),
    );

    const stock = await qr.manager.findOne(Stock, {
      where: {
        organizationId: organization.id,
        storeId: centre.id,
        productId: centreCatalog.tee.id,
        variantId: centreCatalog.blackM.id,
      },
    });
    if (stock) {
      stock.quantity -= 2;
      await qr.manager.save(stock);
    }
    await qr.manager.save(
      qr.manager.create(StockMovement, {
        organizationId: organization.id,
        storeId: centre.id,
        productId: centreCatalog.tee.id,
        variantId: centreCatalog.blackM.id,
        type: StockMovementType.OUT,
        quantity: 2,
        reason: `Sale ${sale.id}`,
        createdBy: users[Role.CASHIER].id,
      }),
    );

    customer.totalSpent = '357.60';
    await qr.manager.save(customer);

    await qr.commitTransaction();
    console.log('Seed complete.');
    console.log('Demo login: owner@ashropos.demo / Demo123!');
    console.log(`Stores: ${centre.name} (${centre.id}), ${marina.name} (${marina.id})`);
  } catch (error) {
    await qr.rollbackTransaction();
    throw error;
  } finally {
    await qr.release();
    await dataSource.destroy();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
