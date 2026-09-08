import { User } from '../modules/users/entities/user.entity';
import { RefreshToken } from '../modules/users/entities/refresh-token.entity';
import { Organization } from '../modules/organizations/entities/organization.entity';
import { OrganizationMember } from '../modules/organizations/entities/organization-member.entity';
import { Store } from '../modules/stores/entities/store.entity';
import { StoreMember } from '../modules/stores/entities/store-member.entity';
import { Category } from '../modules/categories/entities/category.entity';
import { Product } from '../modules/products/entities/product.entity';
import { ProductVariant } from '../modules/products/entities/product-variant.entity';
import { Stock } from '../modules/stock/entities/stock.entity';
import { StockMovement } from '../modules/stock/entities/stock-movement.entity';
import { Sale } from '../modules/sales/entities/sale.entity';
import { SaleItem } from '../modules/sales/entities/sale-item.entity';
import { Payment } from '../modules/sales/entities/payment.entity';
import { Customer } from '../modules/customers/entities/customer.entity';
import { Supplier } from '../modules/suppliers/entities/supplier.entity';
import { PurchaseOrder } from '../modules/purchase-orders/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../modules/purchase-orders/entities/purchase-order-item.entity';
import { Subscription } from '../modules/subscriptions/entities/subscription.entity';
import { StripeWebhookEvent } from '../modules/subscriptions/entities/stripe-webhook-event.entity';
import { AuditLog } from '../modules/audit/entities/audit-log.entity';

export const ALL_ENTITIES = [
  User,
  RefreshToken,
  Organization,
  OrganizationMember,
  Store,
  StoreMember,
  Category,
  Product,
  ProductVariant,
  Stock,
  StockMovement,
  Customer,
  Supplier,
  PurchaseOrder,
  PurchaseOrderItem,
  Sale,
  SaleItem,
  Payment,
  Subscription,
  StripeWebhookEvent,
  AuditLog,
];
