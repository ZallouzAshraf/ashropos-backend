export enum Permission {
  PRODUCTS_READ = 'products:read',
  PRODUCTS_CREATE = 'products:create',
  PRODUCTS_UPDATE = 'products:update',
  PRODUCTS_DELETE = 'products:delete',
  PRODUCTS_UPDATE_PURCHASE_PRICE = 'products:update_purchase_price',

  STOCK_READ = 'stock:read',
  STOCK_MOVEMENT = 'stock:movement',
  STOCK_TRANSFER = 'stock:transfer',

  SALES_CREATE = 'sales:create',
  SALES_READ = 'sales:read',
  SALES_UPDATE = 'sales:update',
  SALES_DELETE = 'sales:delete',

  CUSTOMERS_READ = 'customers:read',
  CUSTOMERS_MANAGE = 'customers:manage',

  SUPPLIERS_READ = 'suppliers:read',
  SUPPLIERS_MANAGE = 'suppliers:manage',

  EMPLOYEES_READ = 'employees:read',
  EMPLOYEES_MANAGE = 'employees:manage',

  STORES_READ = 'stores:read',
  STORES_MANAGE = 'stores:manage',

  ORG_MANAGE = 'org:manage',
  SUBSCRIPTION_MANAGE = 'subscription:manage',

  DASHBOARD_STORE = 'dashboard:store',
  DASHBOARD_ORG = 'dashboard:org',
  REPORTS_READ = 'reports:read',

  PURCHASE_ORDERS_READ = 'purchase_orders:read',
  PURCHASE_ORDERS_MANAGE = 'purchase_orders:manage',

  CATEGORIES_MANAGE = 'categories:manage',
}

export enum SubscriptionPlan {
  FREE = 'free',
  STARTER = 'starter',
  BUSINESS = 'business',
  ENTERPRISE = 'enterprise',
}

export enum SubscriptionStatus {
  TRIALING = 'trialing',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  INCOMPLETE = 'incomplete',
}

export enum StockMovementType {
  IN = 'in',
  OUT = 'out',
  CORRECTION = 'correction',
  TRANSFER_OUT = 'transfer_out',
  TRANSFER_IN = 'transfer_in',
}

export enum SaleStatus {
  COMPLETED = 'completed',
  VOIDED = 'voided',
  REFUNDED = 'refunded',
  PENDING = 'pending',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  MIXED = 'mixed',
  DEFERRED = 'deferred',
}

export enum PurchaseOrderStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  RECEIVED = 'received',
  CANCELLED = 'cancelled',
}
