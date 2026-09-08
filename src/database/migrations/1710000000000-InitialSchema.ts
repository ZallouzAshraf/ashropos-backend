import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1710000000000 implements MigrationInterface {
  name = 'InitialSchema1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TYPE role_enum AS ENUM ('owner', 'admin', 'manager', 'cashier', 'accountant');
      CREATE TYPE subscription_plan_enum AS ENUM ('free', 'starter', 'business', 'enterprise');
      CREATE TYPE subscription_status_enum AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'incomplete');
      CREATE TYPE stock_movement_type_enum AS ENUM ('in', 'out', 'correction', 'transfer_out', 'transfer_in');
      CREATE TYPE sale_status_enum AS ENUM ('completed', 'voided', 'refunded', 'pending');
      CREATE TYPE payment_method_enum AS ENUM ('cash', 'card', 'mixed', 'deferred');
      CREATE TYPE purchase_order_status_enum AS ENUM ('draft', 'sent', 'received', 'cancelled');
    `);

    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        email varchar(255) NOT NULL,
        password_hash varchar(255) NOT NULL,
        first_name varchar(100) NOT NULL,
        last_name varchar(100) NOT NULL,
        phone varchar(30),
        is_active boolean NOT NULL DEFAULT true,
        last_login_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX uq_users_email ON users (LOWER(email));
    `);

    await queryRunner.query(`
      CREATE TABLE organizations (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name varchar(180) NOT NULL,
        slug varchar(80) NOT NULL UNIQUE,
        subscription_plan subscription_plan_enum NOT NULL DEFAULT 'free',
        subscription_status subscription_status_enum NOT NULL DEFAULT 'trialing',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE organization_members (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role role_enum NOT NULL,
        invited_at timestamptz,
        joined_at timestamptz,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (organization_id, user_id)
      );
      CREATE INDEX idx_org_members_org ON organization_members (organization_id);
      CREATE INDEX idx_org_members_user ON organization_members (user_id);
    `);

    await queryRunner.query(`
      CREATE TABLE stores (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name varchar(180) NOT NULL,
        address varchar(255),
        phone varchar(30),
        currency varchar(3) NOT NULL DEFAULT 'TND',
        timezone varchar(64) NOT NULL DEFAULT 'Africa/Casablanca',
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_stores_org ON stores (organization_id);
    `);

    await queryRunner.query(`
      CREATE TABLE store_members (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_override role_enum,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (store_id, user_id)
      );
      CREATE INDEX idx_store_members_org ON store_members (organization_id);
      CREATE INDEX idx_store_members_user ON store_members (user_id);
    `);

    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash varchar(255) NOT NULL UNIQUE,
        organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        created_by_ip varchar(45),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
    `);

    await queryRunner.query(`
      CREATE TABLE categories (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        name varchar(150) NOT NULL,
        parent_category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
        sort_order int NOT NULL DEFAULT 0,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_categories_store ON categories (store_id);
      CREATE INDEX idx_categories_org ON categories (organization_id);
    `);

    await queryRunner.query(`
      CREATE TABLE suppliers (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        store_id uuid REFERENCES stores(id) ON DELETE SET NULL,
        name varchar(180) NOT NULL,
        phone varchar(30),
        email varchar(255),
        address varchar(255),
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_suppliers_org ON suppliers (organization_id);
    `);

    await queryRunner.query(`
      CREATE TABLE products (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        name varchar(200) NOT NULL,
        sku varchar(80),
        barcode varchar(80),
        category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
        purchase_price numeric(12,2) NOT NULL DEFAULT 0,
        selling_price numeric(12,2) NOT NULL DEFAULT 0,
        tax numeric(5,2) NOT NULL DEFAULT 0,
        images jsonb NOT NULL DEFAULT '[]'::jsonb,
        supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
        description text,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_products_store ON products (store_id);
      CREATE INDEX idx_products_org ON products (organization_id);
      CREATE UNIQUE INDEX uq_products_store_sku ON products (store_id, sku) WHERE sku IS NOT NULL;
      CREATE UNIQUE INDEX uq_products_store_barcode ON products (store_id, barcode) WHERE barcode IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE product_variants (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
        sku varchar(80),
        barcode varchar(80),
        selling_price_override numeric(12,2),
        stock_quantity int NOT NULL DEFAULT 0,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_variants_product ON product_variants (product_id);
      CREATE UNIQUE INDEX uq_variants_product_sku ON product_variants (product_id, sku) WHERE sku IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE stocks (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE,
        quantity int NOT NULL DEFAULT 0,
        min_threshold int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_stocks_store ON stocks (store_id);
      CREATE INDEX idx_stocks_org ON stocks (organization_id);
      CREATE UNIQUE INDEX uq_stocks_item ON stocks (
        store_id,
        product_id,
        COALESCE(variant_id, '00000000-0000-0000-0000-000000000000')
      );
    `);

    await queryRunner.query(`
      CREATE TABLE stock_movements (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL,
        type stock_movement_type_enum NOT NULL,
        quantity int NOT NULL,
        reason varchar(255),
        related_store_id uuid REFERENCES stores(id) ON DELETE SET NULL,
        created_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_stock_movements_store ON stock_movements (store_id);
      CREATE INDEX idx_stock_movements_org ON stock_movements (organization_id);
    `);

    await queryRunner.query(`
      CREATE TABLE customers (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        store_id uuid REFERENCES stores(id) ON DELETE SET NULL,
        name varchar(180) NOT NULL,
        phone varchar(30),
        email varchar(255),
        total_spent numeric(12,2) NOT NULL DEFAULT 0,
        debt numeric(12,2) NOT NULL DEFAULT 0,
        notes text,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_customers_org ON customers (organization_id);
      CREATE INDEX idx_customers_store ON customers (store_id);
    `);

    await queryRunner.query(`
      CREATE TABLE purchase_orders (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
        status purchase_order_status_enum NOT NULL DEFAULT 'draft',
        expected_date date,
        notes text,
        total_cost numeric(12,2) NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_po_store ON purchase_orders (store_id);
      CREATE INDEX idx_po_org ON purchase_orders (organization_id);
    `);

    await queryRunner.query(`
      CREATE TABLE purchase_order_items (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
        product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        quantity int NOT NULL,
        received_quantity int NOT NULL DEFAULT 0,
        unit_cost numeric(12,2) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE sales (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        cashier_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
        client_generated_id varchar(64),
        subtotal numeric(12,2) NOT NULL DEFAULT 0,
        discount numeric(12,2) NOT NULL DEFAULT 0,
        tax numeric(12,2) NOT NULL DEFAULT 0,
        total numeric(12,2) NOT NULL DEFAULT 0,
        payment_method payment_method_enum NOT NULL,
        status sale_status_enum NOT NULL DEFAULT 'completed',
        notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_sales_org_created ON sales (organization_id, created_at);
      CREATE INDEX idx_sales_store_created ON sales (store_id, created_at);
      CREATE UNIQUE INDEX uq_sales_client_generated ON sales (store_id, client_generated_id)
        WHERE client_generated_id IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE sale_items (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL,
        product_name varchar(200) NOT NULL,
        sku varchar(80),
        quantity int NOT NULL,
        unit_price numeric(12,2) NOT NULL,
        purchase_price numeric(12,2) NOT NULL DEFAULT 0,
        tax_rate numeric(5,2) NOT NULL DEFAULT 0,
        discount numeric(12,2) NOT NULL DEFAULT 0,
        total numeric(12,2) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_sale_items_sale ON sale_items (sale_id);
      CREATE INDEX idx_sale_items_org ON sale_items (organization_id);
    `);

    await queryRunner.query(`
      CREATE TABLE payments (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        method payment_method_enum NOT NULL,
        amount numeric(12,2) NOT NULL,
        reference varchar(120),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_payments_sale ON payments (sale_id);
    `);

    await queryRunner.query(`
      CREATE TABLE subscriptions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
        plan subscription_plan_enum NOT NULL DEFAULT 'free',
        status subscription_status_enum NOT NULL DEFAULT 'trialing',
        current_period_end timestamptz,
        seats_limit int NOT NULL DEFAULT 3,
        stores_limit int NOT NULL DEFAULT 1,
        stripe_customer_id varchar(255) UNIQUE,
        stripe_subscription_id varchar(255) UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE stripe_webhook_events (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid,
        stripe_event_id varchar(255) NOT NULL UNIQUE,
        type varchar(120) NOT NULL,
        payload jsonb NOT NULL,
        processed boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        action varchar(80) NOT NULL,
        entity_type varchar(80) NOT NULL,
        entity_id uuid,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_audit_org_created ON audit_logs (organization_id, created_at);
    `);

    await queryRunner.query(`
      CREATE OR REPLACE VIEW v_store_sales_daily AS
      SELECT
        organization_id,
        store_id,
        date_trunc('day', created_at) AS day,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS sales_count,
        COALESCE(SUM(total) FILTER (WHERE status = 'completed'), 0) AS revenue,
        COALESCE(AVG(total) FILTER (WHERE status = 'completed'), 0) AS avg_basket
      FROM sales
      GROUP BY organization_id, store_id, date_trunc('day', created_at);
    `);

    await queryRunner.query(`
      CREATE OR REPLACE VIEW v_store_profit_daily AS
      SELECT
        s.organization_id,
        s.store_id,
        date_trunc('day', s.created_at) AS day,
        COALESCE(SUM(
          (si.unit_price - si.purchase_price) * si.quantity - si.discount
        ) FILTER (WHERE s.status = 'completed'), 0) AS estimated_profit
      FROM sales s
      INNER JOIN sale_items si ON si.sale_id = s.id
      GROUP BY s.organization_id, s.store_id, date_trunc('day', s.created_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS v_store_profit_daily`);
    await queryRunner.query(`DROP VIEW IF EXISTS v_store_sales_daily`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS stripe_webhook_events`);
    await queryRunner.query(`DROP TABLE IF EXISTS subscriptions`);
    await queryRunner.query(`DROP TABLE IF EXISTS payments`);
    await queryRunner.query(`DROP TABLE IF EXISTS sale_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS sales`);
    await queryRunner.query(`DROP TABLE IF EXISTS purchase_order_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS purchase_orders`);
    await queryRunner.query(`DROP TABLE IF EXISTS customers`);
    await queryRunner.query(`DROP TABLE IF EXISTS stock_movements`);
    await queryRunner.query(`DROP TABLE IF EXISTS stocks`);
    await queryRunner.query(`DROP TABLE IF EXISTS product_variants`);
    await queryRunner.query(`DROP TABLE IF EXISTS products`);
    await queryRunner.query(`DROP TABLE IF EXISTS suppliers`);
    await queryRunner.query(`DROP TABLE IF EXISTS categories`);
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS store_members`);
    await queryRunner.query(`DROP TABLE IF EXISTS stores`);
    await queryRunner.query(`DROP TABLE IF EXISTS organization_members`);
    await queryRunner.query(`DROP TABLE IF EXISTS organizations`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`
      DROP TYPE IF EXISTS purchase_order_status_enum;
      DROP TYPE IF EXISTS payment_method_enum;
      DROP TYPE IF EXISTS sale_status_enum;
      DROP TYPE IF EXISTS stock_movement_type_enum;
      DROP TYPE IF EXISTS subscription_status_enum;
      DROP TYPE IF EXISTS subscription_plan_enum;
      DROP TYPE IF EXISTS role_enum;
    `);
  }
}
