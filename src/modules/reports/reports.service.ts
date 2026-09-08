import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthUser } from '../../common/types/auth-user';
import { toNumber } from '../../common/utils/helpers';
import { StoresService } from '../stores/stores.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly storesService: StoresService,
  ) {}

  async storeDashboard(user: AuthUser, storeId: string, day = new Date()) {
    await this.storesService.requireStore(user, storeId);
    const { from, to } = this.dayBounds(day);

    const [kpis] = await this.dataSource.query(
      `
      SELECT
        COALESCE(SUM(total) FILTER (WHERE status = 'completed'), 0)::float AS revenue,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS sales_count,
        COALESCE(AVG(total) FILTER (WHERE status = 'completed'), 0)::float AS avg_basket
      FROM sales
      WHERE organization_id = $1
        AND store_id = $2
        AND created_at >= $3
        AND created_at < $4
      `,
      [user.organizationId, storeId, from, to],
    );

    const [profit] = await this.dataSource.query(
      `
      SELECT COALESCE(SUM(
        (si.unit_price - si.purchase_price) * si.quantity - si.discount
      ), 0)::float AS estimated_profit
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      WHERE s.organization_id = $1
        AND s.store_id = $2
        AND s.status = 'completed'
        AND s.created_at >= $3
        AND s.created_at < $4
      `,
      [user.organizationId, storeId, from, to],
    );

    const popularProducts = await this.dataSource.query(
      `
      SELECT
        si.product_id AS "productId",
        si.product_name AS "productName",
        SUM(si.quantity)::int AS quantity,
        SUM(si.total)::float AS revenue
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      WHERE s.organization_id = $1
        AND s.store_id = $2
        AND s.status = 'completed'
        AND s.created_at >= $3
        AND s.created_at < $4
      GROUP BY si.product_id, si.product_name
      ORDER BY quantity DESC
      LIMIT 8
      `,
      [user.organizationId, storeId, from, to],
    );

    const lowStock = await this.dataSource.query(
      `
      SELECT
        st.id,
        st.product_id AS "productId",
        st.variant_id AS "variantId",
        st.quantity,
        st.min_threshold AS "minThreshold",
        p.name AS "productName"
      FROM stocks st
      INNER JOIN products p ON p.id = st.product_id
      WHERE st.organization_id = $1
        AND st.store_id = $2
        AND st.min_threshold > 0
        AND st.quantity <= st.min_threshold
      ORDER BY st.quantity ASC
      LIMIT 20
      `,
      [user.organizationId, storeId],
    );

    return {
      storeId,
      date: this.localDate(day),
      revenue: toNumber(kpis?.revenue),
      salesCount: Number(kpis?.sales_count ?? 0),
      avgBasket: toNumber(kpis?.avg_basket),
      estimatedProfit: toNumber(profit?.estimated_profit),
      popularProducts,
      lowStock,
    };
  }

  async organizationDashboard(user: AuthUser, day = new Date()) {
    const { from, to } = this.dayBounds(day);

    const [kpis] = await this.dataSource.query(
      `
      SELECT
        COALESCE(SUM(total) FILTER (WHERE status = 'completed'), 0)::float AS revenue,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS sales_count,
        COALESCE(AVG(total) FILTER (WHERE status = 'completed'), 0)::float AS avg_basket
      FROM sales
      WHERE organization_id = $1
        AND created_at >= $2
        AND created_at < $3
      `,
      [user.organizationId, from, to],
    );

    const [profit] = await this.dataSource.query(
      `
      SELECT COALESCE(SUM(
        (si.unit_price - si.purchase_price) * si.quantity - si.discount
      ), 0)::float AS estimated_profit
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      WHERE s.organization_id = $1
        AND s.status = 'completed'
        AND s.created_at >= $2
        AND s.created_at < $3
      `,
      [user.organizationId, from, to],
    );

    const breakdown = await this.dataSource.query(
      `
      SELECT
        st.id AS "storeId",
        st.name AS "storeName",
        COALESCE(SUM(s.total) FILTER (WHERE s.status = 'completed'), 0)::float AS revenue,
        COUNT(*) FILTER (WHERE s.status = 'completed')::int AS sales_count
      FROM stores st
      LEFT JOIN sales s
        ON s.store_id = st.id
        AND s.organization_id = st.organization_id
        AND s.created_at >= $2
        AND s.created_at < $3
      WHERE st.organization_id = $1
      GROUP BY st.id, st.name
      ORDER BY revenue DESC
      `,
      [user.organizationId, from, to],
    );

    const popularProducts = await this.dataSource.query(
      `
      SELECT
        si.product_id AS "productId",
        si.product_name AS "productName",
        SUM(si.quantity)::int AS quantity,
        SUM(si.total)::float AS revenue
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      WHERE s.organization_id = $1
        AND s.status = 'completed'
        AND s.created_at >= $2
        AND s.created_at < $3
      GROUP BY si.product_id, si.product_name
      ORDER BY quantity DESC
      LIMIT 8
      `,
      [user.organizationId, from, to],
    );

    const lowStock = await this.dataSource.query(
      `
      SELECT
        st.id,
        st.product_id AS "productId",
        st.variant_id AS "variantId",
        st.quantity,
        st.min_threshold AS "minThreshold",
        p.name AS "productName",
        s.name AS "storeName"
      FROM stocks st
      INNER JOIN products p ON p.id = st.product_id
      INNER JOIN stores s ON s.id = st.store_id
      WHERE st.organization_id = $1
        AND st.min_threshold > 0
        AND st.quantity <= st.min_threshold
      ORDER BY st.quantity ASC
      LIMIT 20
      `,
      [user.organizationId],
    );

    return {
      organizationId: user.organizationId,
      date: this.localDate(day),
      revenue: toNumber(kpis?.revenue),
      salesCount: Number(kpis?.sales_count ?? 0),
      avgBasket: toNumber(kpis?.avg_basket),
      estimatedProfit: toNumber(profit?.estimated_profit),
      breakdown,
      popularProducts,
      lowStock,
    };
  }

  private dayBounds(day: Date): { from: Date; to: Date } {
    const from = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return { from, to };
  }

  private localDate(day: Date): string {
    const y = day.getFullYear();
    const m = String(day.getMonth() + 1).padStart(2, '0');
    const d = String(day.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
