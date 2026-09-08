import 'reflect-metadata';
import { config } from 'dotenv';
import * as bcrypt from 'bcryptjs';
import dataSource from '../data-source';
import { Role } from '../../common/enums/role.enum';
import {
  PaymentMethod,
  PurchaseOrderStatus,
  SaleStatus,
  StockMovementType,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../common/enums/permission.enum';
import { roundMoney } from '../../common/utils/helpers';
import { User } from '../../modules/users/entities/user.entity';
import { RefreshToken } from '../../modules/users/entities/refresh-token.entity';
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
import { PurchaseOrder } from '../../modules/purchase-orders/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../modules/purchase-orders/entities/purchase-order-item.entity';
import { AuditLog } from '../../modules/audit/entities/audit-log.entity';
import { CLOTHING_CATALOG, CLOTHING_CATEGORIES, type CatalogProduct, type SupplierKey } from './clothing-catalog';
import type { QueryRunner } from 'typeorm';

config();

const DEMO_PASSWORD = 'Demo123!';
const DEMO_EMAILS = [
  'owner@ashropos.demo',
  'admin@ashropos.demo',
  'manager@ashropos.demo',
  'cashier@ashropos.demo',
  'accountant@ashropos.demo',
];

type Sellable = {
  product: Product;
  variant: ProductVariant | null;
  stock: Stock;
  name: string;
  sku: string | null;
  unitPrice: number;
  purchasePrice: number;
  tax: number;
};

function money(value: number) {
  return roundMoney(value).toFixed(2);
}

function variantLabel(attributes: Record<string, string>) {
  return Object.values(attributes).filter(Boolean).join(' · ');
}

function skuOf(prefix: string, product: CatalogProduct, variant?: { couleur?: string; taille?: string }) {
  const parts = [prefix, product.sku];
  if (variant?.couleur) parts.push(variant.couleur.slice(0, 4).toUpperCase());
  if (variant?.taille) parts.push(variant.taille);
  return parts.join('-');
}

async function wipeDemo(qr: QueryRunner, organizationId: string, userIds: string[]) {
  await qr.manager.delete(Payment, { organizationId });
  await qr.manager.delete(SaleItem, { organizationId });
  await qr.manager.delete(Sale, { organizationId });
  await qr.manager.delete(StockMovement, { organizationId });
  await qr.manager.delete(Stock, { organizationId });
  await qr.manager.delete(PurchaseOrderItem, { organizationId });
  await qr.manager.delete(PurchaseOrder, { organizationId });
  await qr.manager.delete(ProductVariant, { organizationId });
  await qr.manager.delete(Product, { organizationId });
  await qr.manager.delete(Category, { organizationId });
  await qr.manager.delete(Customer, { organizationId });
  await qr.manager.delete(Supplier, { organizationId });
  await qr.manager.delete(StoreMember, { organizationId });
  await qr.manager.delete(AuditLog, { organizationId });
  await qr.manager.delete(Store, { organizationId });
  await qr.manager.delete(OrganizationMember, { organizationId });
  await qr.manager.delete(Subscription, { organizationId });
  if (userIds.length) {
    await qr.manager
      .createQueryBuilder()
      .delete()
      .from(RefreshToken)
      .where('user_id IN (:...ids)', { ids: userIds })
      .execute();
  }
  await qr.manager.delete(Organization, { id: organizationId });
  if (userIds.length) {
    await qr.manager
      .createQueryBuilder()
      .delete()
      .from(User)
      .where('id IN (:...ids)', { ids: userIds })
      .execute();
  }
}

async function seed() {
  await dataSource.initialize();
  const qr = dataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    const existing = await qr.manager.findOne(Organization, { where: { slug: 'ashro-demo' } });
    if (existing) {
      const members = await qr.manager.find(OrganizationMember, {
        where: { organizationId: existing.id },
      });
      console.log('Réinitialisation de l’organisation démo…');
      await wipeDemo(
        qr,
        existing.id,
        members.map((m) => m.userId),
      );
    }

    const leftoverUsers = await qr.manager
      .createQueryBuilder(User, 'user')
      .where('user.email IN (:...emails)', { emails: DEMO_EMAILS })
      .getMany();
    if (leftoverUsers.length) {
      const ids = leftoverUsers.map((u) => u.id);
      await qr.manager
        .createQueryBuilder()
        .delete()
        .from(RefreshToken)
        .where('user_id IN (:...ids)', { ids })
        .execute();
      await qr.manager
        .createQueryBuilder()
        .delete()
        .from(User)
        .where('id IN (:...ids)', { ids })
        .execute();
    }

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);

    const organization = await qr.manager.save(
      qr.manager.create(Organization, {
        name: 'Ashro Mode',
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

    const lafayette = await qr.manager.save(
      qr.manager.create(Store, {
        organizationId: organization.id,
        name: 'Ashro Mode Lafayette',
        address: '14 Avenue de Paris, Tunis',
        phone: '+21671123456',
        currency: 'TND',
        timezone: 'Africa/Tunis',
      }),
    );
    const marsa = await qr.manager.save(
      qr.manager.create(Store, {
        organizationId: organization.id,
        name: 'Ashro Mode La Marsa',
        address: '12 Avenue Taieb Mhiri, La Marsa',
        phone: '+21671789012',
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
      { email: 'owner@ashropos.demo', firstName: 'Amal', lastName: 'Gharbi', role: Role.OWNER, storeIds: [] },
      { email: 'admin@ashropos.demo', firstName: 'Youssef', lastName: 'Ben Ali', role: Role.ADMIN, storeIds: [] },
      {
        email: 'manager@ashropos.demo',
        firstName: 'Sara',
        lastName: 'Jebali',
        role: Role.MANAGER,
        storeIds: [lafayette.id, marsa.id],
      },
      {
        email: 'cashier@ashropos.demo',
        firstName: 'Karim',
        lastName: 'Tounsi',
        role: Role.CASHIER,
        storeIds: [lafayette.id],
      },
      {
        email: 'accountant@ashropos.demo',
        firstName: 'Nadia',
        lastName: 'Mansour',
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

    const suppliers = {
      textile: await qr.manager.save(
        qr.manager.create(Supplier, {
          organizationId: organization.id,
          name: 'Textile Sfax',
          phone: '+21674200100',
          email: 'commandes@textile-sfax.tn',
          address: 'Zone industrielle Poudrière, Sfax',
        }),
      ),
      chaussure: await qr.manager.save(
        qr.manager.create(Supplier, {
          organizationId: organization.id,
          name: 'Chaussures Radès Import',
          phone: '+21671333444',
          email: 'hello@rades-shoes.tn',
          address: 'Port de Radès',
        }),
      ),
      maroquinerie: await qr.manager.save(
        qr.manager.create(Supplier, {
          organizationId: organization.id,
          name: 'Maroquinerie Ben Arous',
          phone: '+21671300111',
          email: 'contact@maroquinerie-ba.tn',
          address: 'Bir El Bey, Ben Arous',
        }),
      ),
    } satisfies Record<SupplierKey, Supplier>;

    async function seedStoreCatalog(store: Store, prefix: string, barcodeBase: number) {
      const categories: Record<string, Category> = {};
      for (const name of CLOTHING_CATEGORIES) {
        categories[name] = await qr.manager.save(
          qr.manager.create(Category, {
            organizationId: organization.id,
            storeId: store.id,
            name,
          }),
        );
      }

      const sellables: Sellable[] = [];
      let barcodeSeq = barcodeBase;

      for (const item of CLOTHING_CATALOG) {
        const product = await qr.manager.save(
          qr.manager.create(Product, {
            organizationId: organization.id,
            storeId: store.id,
            name: item.name,
            sku: `${prefix}-${item.sku}`,
            barcode: String(barcodeSeq++),
            categoryId: categories[item.category].id,
            purchasePrice: money(item.purchasePrice),
            sellingPrice: money(item.sellingPrice),
            tax: money(item.tax),
            images: [],
            supplierId: suppliers[item.supplier].id,
            description: item.description,
            isActive: true,
          }),
        );

        if (item.variants?.length) {
          for (const variantDef of item.variants) {
            const attributes: Record<string, string> = {};
            if (variantDef.couleur) attributes.couleur = variantDef.couleur;
            if (variantDef.taille) attributes.taille = variantDef.taille;
            const variant = await qr.manager.save(
              qr.manager.create(ProductVariant, {
                organizationId: organization.id,
                storeId: store.id,
                productId: product.id,
                attributes,
                sku: skuOf(prefix, item, variantDef),
                sellingPriceOverride: money(item.sellingPrice),
                stockQuantity: variantDef.quantity,
              }),
            );
            const stock = await qr.manager.save(
              qr.manager.create(Stock, {
                organizationId: organization.id,
                storeId: store.id,
                productId: product.id,
                variantId: variant.id,
                quantity: variantDef.quantity,
                minThreshold: variantDef.minThreshold,
              }),
            );
            await qr.manager.save(
              qr.manager.create(StockMovement, {
                organizationId: organization.id,
                storeId: store.id,
                productId: product.id,
                variantId: variant.id,
                type: StockMovementType.IN,
                quantity: variantDef.quantity,
                reason: 'Réception initiale',
                createdBy: users[Role.MANAGER].id,
              }),
            );
            sellables.push({
              product,
              variant,
              stock,
              name: `${item.name} · ${variantLabel(attributes)}`,
              sku: variant.sku,
              unitPrice: item.sellingPrice,
              purchasePrice: item.purchasePrice,
              tax: item.tax,
            });
          }
        } else {
          const stock = await qr.manager.save(
            qr.manager.create(Stock, {
              organizationId: organization.id,
              storeId: store.id,
              productId: product.id,
              variantId: null,
              quantity: item.quantity ?? 10,
              minThreshold: item.minThreshold ?? 3,
            }),
          );
          await qr.manager.save(
            qr.manager.create(StockMovement, {
              organizationId: organization.id,
              storeId: store.id,
              productId: product.id,
              variantId: null,
              type: StockMovementType.IN,
              quantity: item.quantity ?? 10,
              reason: 'Réception initiale',
              createdBy: users[Role.MANAGER].id,
            }),
          );
          sellables.push({
            product,
            variant: null,
            stock,
            name: item.name,
            sku: product.sku,
            unitPrice: item.sellingPrice,
            purchasePrice: item.purchasePrice,
            tax: item.tax,
          });
        }
      }

      return sellables;
    }

    const lafayetteCatalog = await seedStoreCatalog(lafayette, 'LAF', 61911001);
    const marsaCatalog = await seedStoreCatalog(marsa, 'MRS', 61922001);

    const customers = await qr.manager.save(
      qr.manager.create(Customer, [
        {
          organizationId: organization.id,
          storeId: lafayette.id,
          name: 'Amira Trabelsi',
          phone: '+21698111222',
          email: 'amira.trabelsi@demo.tn',
          notes: 'Cliente fidèle — préfère les tailles M',
        },
        {
          organizationId: organization.id,
          storeId: lafayette.id,
          name: 'Mehdi Gharbi',
          phone: '+21622333444',
          email: 'mehdi.gharbi@demo.tn',
        },
        {
          organizationId: organization.id,
          storeId: lafayette.id,
          name: 'Fatma Jebali',
          phone: '+21655566777',
          email: 'fatma.jebali@demo.tn',
          notes: 'Paiement différé autorisé',
        },
        {
          organizationId: organization.id,
          storeId: lafayette.id,
          name: 'Karim Bouazizi',
          phone: '+21698765432',
        },
        {
          organizationId: organization.id,
          storeId: marsa.id,
          name: 'Nour Ben Salem',
          phone: '+21624681012',
          email: 'nour.bensalem@demo.tn',
        },
        {
          organizationId: organization.id,
          storeId: marsa.id,
          name: 'Yassine Khelifi',
          phone: '+21650909090',
          email: 'yassine.khelifi@demo.tn',
        },
        {
          organizationId: organization.id,
          storeId: marsa.id,
          name: 'Leila Mansouri',
          phone: '+21621212121',
          email: 'leila.mansouri@demo.tn',
        },
        {
          organizationId: organization.id,
          storeId: null,
          name: 'Client passage',
          notes: 'Ventes anonymes de caisse',
        },
      ]),
    );

    const [amira, mehdi, fatma, karim, nour, yassine, leila] = customers;

    async function createSale(params: {
      store: Store;
      catalog: Sellable[];
      cashierId: string;
      customer?: Customer | null;
      picks: Array<{ match: string; qty: number }>;
      method: PaymentMethod;
      at: Date;
      discount?: number;
      note?: string;
      clientGeneratedId: string;
    }) {
      const lines = params.picks
        .map((pick) => {
          const item = params.catalog.find((row) => row.name.toLowerCase().includes(pick.match.toLowerCase()));
          return item ? { item, qty: pick.qty } : null;
        })
        .filter((row): row is { item: Sellable; qty: number } => Boolean(row))
        .filter((row) => row.item.stock.quantity >= row.qty);

      if (!lines.length) return null;

      let subtotal = 0;
      let tax = 0;
      const discount = params.discount ?? 0;
      const built = lines.map(({ item, qty }) => {
        const ht = roundMoney(item.unitPrice * qty);
        const lineTax = roundMoney(ht * (item.tax / 100));
        subtotal += ht;
        tax += lineTax;
        return { item, qty, ht, lineTax, ttc: roundMoney(ht + lineTax) };
      });
      subtotal = roundMoney(subtotal);
      tax = roundMoney(tax);
      const total = roundMoney(Math.max(0, subtotal + tax - discount));

      const sale = await qr.manager.save(
        qr.manager.create(Sale, {
          organizationId: organization.id,
          storeId: params.store.id,
          cashierId: params.cashierId,
          customerId: params.customer?.id ?? null,
          clientGeneratedId: params.clientGeneratedId,
          subtotal: money(subtotal),
          discount: money(discount),
          tax: money(tax),
          total: money(total),
          paymentMethod: params.method,
          status: SaleStatus.COMPLETED,
          notes: params.note ?? null,
        }),
      );
      await qr.query(`UPDATE sales SET created_at = $1, updated_at = $1 WHERE id = $2`, [params.at, sale.id]);

      for (const line of built) {
        await qr.manager.save(
          qr.manager.create(SaleItem, {
            organizationId: organization.id,
            saleId: sale.id,
            productId: line.item.product.id,
            variantId: line.item.variant?.id ?? null,
            productName: line.item.name,
            sku: line.item.sku,
            quantity: line.qty,
            unitPrice: money(line.item.unitPrice),
            purchasePrice: money(line.item.purchasePrice),
            taxRate: money(line.item.tax),
            discount: '0.00',
            total: money(line.ttc),
          }),
        );
        line.item.stock.quantity -= line.qty;
        await qr.manager.save(line.item.stock);
        if (line.item.variant) {
          line.item.variant.stockQuantity = line.item.stock.quantity;
          await qr.manager.save(line.item.variant);
        }
        await qr.manager.save(
          qr.manager.create(StockMovement, {
            organizationId: organization.id,
            storeId: params.store.id,
            productId: line.item.product.id,
            variantId: line.item.variant?.id ?? null,
            type: StockMovementType.OUT,
            quantity: line.qty,
            reason: `Vente ${sale.id.slice(0, 8)}`,
            createdBy: params.cashierId,
          }),
        );
      }

      await qr.manager.save(
        qr.manager.create(Payment, {
          organizationId: organization.id,
          saleId: sale.id,
          method: params.method,
          amount: money(total),
        }),
      );

      if (params.customer) {
        params.customer.totalSpent = money(Number(params.customer.totalSpent) + total);
        if (params.method === PaymentMethod.DEFERRED) {
          params.customer.debt = money(Number(params.customer.debt) + total);
        }
        await qr.manager.save(params.customer);
      }

      return sale;
    }

    const daysAgo = (days: number, hour: number) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      d.setHours(hour, 15 + days, 0, 0);
      return d;
    };

    const lafCashier = users[Role.CASHIER].id;
    const marsaCashier = users[Role.MANAGER].id;

    const lafSales: Array<Parameters<typeof createSale>[0]> = [
      {
        store: lafayette,
        catalog: lafayetteCatalog,
        cashierId: lafCashier,
        customer: amira,
        picks: [
          { match: 't-shirt coton essential · noir · m', qty: 2 },
          { match: 'chaussettes coton — pack 3 · noir', qty: 1 },
        ],
        method: PaymentMethod.CARD,
        at: daysAgo(0, 10),
        clientGeneratedId: 'seed-laf-01',
      },
      {
        store: lafayette,
        catalog: lafayetteCatalog,
        cashierId: lafCashier,
        customer: mehdi,
        picks: [
          { match: 'jean slim stretch · bleu · 40', qty: 1 },
          { match: 'ceinture cuir · noir · 95', qty: 1 },
        ],
        method: PaymentMethod.CASH,
        at: daysAgo(0, 12),
        clientGeneratedId: 'seed-laf-02',
      },
      {
        store: lafayette,
        catalog: lafayetteCatalog,
        cashierId: lafCashier,
        customer: karim,
        picks: [{ match: 'baskets urbaines · blanc · 42', qty: 1 }],
        method: PaymentMethod.CARD,
        at: daysAgo(0, 16),
        clientGeneratedId: 'seed-laf-03',
      },
      {
        store: lafayette,
        catalog: lafayetteCatalog,
        cashierId: lafCashier,
        customer: fatma,
        picks: [
          { match: 'robe midi lin · olive · m', qty: 1 },
          { match: 'sandales cuir · camel · 38', qty: 1 },
        ],
        method: PaymentMethod.DEFERRED,
        at: daysAgo(1, 11),
        note: 'Paiement à la livraison',
        clientGeneratedId: 'seed-laf-04',
      },
      {
        store: lafayette,
        catalog: lafayetteCatalog,
        cashierId: lafCashier,
        picks: [
          { match: 'cartable scolaire 2 compartiments · marine', qty: 1 },
          { match: 'trousse école · bleu', qty: 2 },
          { match: 'chaussettes invisibles', qty: 1 },
        ],
        method: PaymentMethod.CASH,
        at: daysAgo(1, 17),
        clientGeneratedId: 'seed-laf-05',
      },
      {
        store: lafayette,
        catalog: lafayetteCatalog,
        cashierId: lafCashier,
        customer: amira,
        picks: [
          { match: 'sweat à capuche · gris · m', qty: 1 },
          { match: 'jogging molleton · noir · m', qty: 1 },
        ],
        method: PaymentMethod.CARD,
        at: daysAgo(2, 14),
        clientGeneratedId: 'seed-laf-06',
      },
      {
        store: lafayette,
        catalog: lafayetteCatalog,
        cashierId: lafCashier,
        picks: [
          { match: 'polo piqué · marine · l', qty: 1 },
          { match: 'chino coupe droite · beige · 42', qty: 1 },
        ],
        method: PaymentMethod.MIXED,
        at: daysAgo(3, 13),
        clientGeneratedId: 'seed-laf-07',
      },
      {
        store: lafayette,
        catalog: lafayetteCatalog,
        cashierId: lafCashier,
        customer: mehdi,
        picks: [{ match: 'chemise oxford · blanc · l', qty: 2 }],
        method: PaymentMethod.CARD,
        at: daysAgo(4, 15),
        discount: 10,
        clientGeneratedId: 'seed-laf-08',
      },
      {
        store: lafayette,
        catalog: lafayetteCatalog,
        cashierId: lafCashier,
        picks: [
          { match: 'veste bomber · noir · m', qty: 1 },
          { match: 'bonnet côtes · gris', qty: 1 },
        ],
        method: PaymentMethod.CASH,
        at: daysAgo(5, 18),
        clientGeneratedId: 'seed-laf-09',
      },
      {
        store: lafayette,
        catalog: lafayetteCatalog,
        cashierId: lafCashier,
        customer: karim,
        picks: [
          { match: 'sac à dos quotidien · noir', qty: 1 },
          { match: 'portefeuille cuir · noir', qty: 1 },
        ],
        method: PaymentMethod.CARD,
        at: daysAgo(6, 11),
        clientGeneratedId: 'seed-laf-10',
      },
      {
        store: lafayette,
        catalog: lafayetteCatalog,
        cashierId: lafCashier,
        picks: [
          { match: 't-shirt coton essential · blanc · m', qty: 3 },
          { match: 'casquette baseball · noir', qty: 1 },
        ],
        method: PaymentMethod.CASH,
        at: daysAgo(8, 16),
        clientGeneratedId: 'seed-laf-11',
      },
      {
        store: lafayette,
        catalog: lafayetteCatalog,
        cashierId: lafCashier,
        customer: amira,
        picks: [
          { match: 'jupe plissée · noir · m', qty: 1 },
          { match: 'chemisier fluide · rose · m', qty: 1 },
          { match: 'écharpe laine · camel', qty: 1 },
        ],
        method: PaymentMethod.CARD,
        at: daysAgo(10, 12),
        clientGeneratedId: 'seed-laf-12',
      },
      {
        store: lafayette,
        catalog: lafayetteCatalog,
        cashierId: lafCashier,
        picks: [{ match: 'sac cabas toile', qty: 2 }],
        method: PaymentMethod.CASH,
        at: daysAgo(12, 10),
        clientGeneratedId: 'seed-laf-13',
      },
    ];

    const mrsSales: Array<Parameters<typeof createSale>[0]> = [
      {
        store: marsa,
        catalog: marsaCatalog,
        cashierId: marsaCashier,
        customer: nour,
        picks: [
          { match: 'robe midi lin · sable · s', qty: 1 },
          { match: 'sandales cuir · camel · 37', qty: 1 },
        ],
        method: PaymentMethod.CARD,
        at: daysAgo(0, 11),
        clientGeneratedId: 'seed-mrs-01',
      },
      {
        store: marsa,
        catalog: marsaCatalog,
        cashierId: marsaCashier,
        customer: yassine,
        picks: [
          { match: 'baskets urbaines · noir · 41', qty: 1 },
          { match: 'chaussettes coton — pack 3 · blanc', qty: 2 },
        ],
        method: PaymentMethod.CASH,
        at: daysAgo(0, 15),
        clientGeneratedId: 'seed-mrs-02',
      },
      {
        store: marsa,
        catalog: marsaCatalog,
        cashierId: marsaCashier,
        customer: leila,
        picks: [
          { match: 'cardigan maille · crème · m', qty: 1 },
          { match: 'collants 20 deniers · noir · m', qty: 2 },
        ],
        method: PaymentMethod.CARD,
        at: daysAgo(1, 13),
        clientGeneratedId: 'seed-mrs-03',
      },
      {
        store: marsa,
        catalog: marsaCatalog,
        cashierId: marsaCashier,
        picks: [
          { match: 'cartable scolaire 2 compartiments · marine', qty: 1 },
          { match: 'trousse école · bleu', qty: 1 },
        ],
        method: PaymentMethod.CASH,
        at: daysAgo(2, 17),
        clientGeneratedId: 'seed-mrs-04',
      },
      {
        store: marsa,
        catalog: marsaCatalog,
        cashierId: marsaCashier,
        customer: nour,
        picks: [
          { match: 't-shirt coton essential · beige · m', qty: 2 },
          { match: 'short chino · beige · m', qty: 1 },
        ],
        method: PaymentMethod.MIXED,
        at: daysAgo(4, 12),
        clientGeneratedId: 'seed-mrs-05',
      },
      {
        store: marsa,
        catalog: marsaCatalog,
        cashierId: marsaCashier,
        customer: yassine,
        picks: [
          { match: 'sweat à capuche · noir · l', qty: 1 },
          { match: 'jogging molleton · noir · l', qty: 1 },
        ],
        method: PaymentMethod.CARD,
        at: daysAgo(7, 16),
        clientGeneratedId: 'seed-mrs-06',
      },
      {
        store: marsa,
        catalog: marsaCatalog,
        cashierId: marsaCashier,
        picks: [
          { match: 'sac bandoulière · cognac', qty: 1 },
          { match: 'ceinture cuir · marron · 90', qty: 1 },
        ],
        method: PaymentMethod.CASH,
        at: daysAgo(9, 14),
        clientGeneratedId: 'seed-mrs-07',
      },
      {
        store: marsa,
        catalog: marsaCatalog,
        cashierId: marsaCashier,
        customer: leila,
        picks: [{ match: 'mocassins · marron · 41', qty: 1 }],
        method: PaymentMethod.DEFERRED,
        at: daysAgo(11, 11),
        clientGeneratedId: 'seed-mrs-08',
      },
    ];

    for (const sale of [...lafSales, ...mrsSales]) {
      await createSale(sale);
    }

    const socks = lafayetteCatalog.find((row) => row.sku?.includes('CHA-COT3') && row.name.includes('Noir'));
    const cartable = lafayetteCatalog.find((row) => row.sku?.includes('CAR-SCO') && row.name.includes('Marine'));
    if (socks && cartable) {
      const poReceived = await qr.manager.save(
        qr.manager.create(PurchaseOrder, {
          organizationId: organization.id,
          storeId: lafayette.id,
          supplierId: suppliers.maroquinerie.id,
          status: PurchaseOrderStatus.RECEIVED,
          expectedDate: daysAgo(3, 9).toISOString().slice(0, 10),
          notes: 'Rentrée scolaire — cartables & basiques',
          totalCost: money(socks.purchasePrice * 24 + cartable.purchasePrice * 6),
        }),
      );
      await qr.manager.save([
        qr.manager.create(PurchaseOrderItem, {
          organizationId: organization.id,
          purchaseOrderId: poReceived.id,
          productId: socks.product.id,
          quantity: 24,
          receivedQuantity: 24,
          unitCost: money(socks.purchasePrice),
        }),
        qr.manager.create(PurchaseOrderItem, {
          organizationId: organization.id,
          purchaseOrderId: poReceived.id,
          productId: cartable.product.id,
          quantity: 6,
          receivedQuantity: 6,
          unitCost: money(cartable.purchasePrice),
        }),
      ]);
    }

    const bomber = lafayetteCatalog.find((row) => row.name.toLowerCase().includes('veste bomber'));
    if (bomber) {
      const poSent = await qr.manager.save(
        qr.manager.create(PurchaseOrder, {
          organizationId: organization.id,
          storeId: lafayette.id,
          supplierId: suppliers.textile.id,
          status: PurchaseOrderStatus.SENT,
          expectedDate: daysAgo(-8, 9).toISOString().slice(0, 10),
          notes: 'Réassort vestes automne',
          totalCost: money(bomber.purchasePrice * 12),
        }),
      );
      await qr.manager.save(
        qr.manager.create(PurchaseOrderItem, {
          organizationId: organization.id,
          purchaseOrderId: poSent.id,
          productId: bomber.product.id,
          quantity: 12,
          receivedQuantity: 0,
          unitCost: money(bomber.purchasePrice),
        }),
      );
    }

    await qr.commitTransaction();
    console.log('Seed boutique vêtements terminé.');
    console.log('Connexion : owner@ashropos.demo / Demo123!');
    console.log(`Boutiques : ${lafayette.name}, ${marsa.name}`);
    console.log(
      `Catalogue : ${CLOTHING_CATALOG.length} produits · ${lafayetteCatalog.length} SKUs / boutique`,
    );
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
