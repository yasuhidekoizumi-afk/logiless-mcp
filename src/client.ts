import https from "node:https";

const API_BASE = "app2.logiless.com";
const API_PATH_PREFIX = "/api/v1";

export class LogilessClient {
  private accessToken: string;
  private merchantId: string;

  constructor(accessToken: string, merchantId: string) {
    this.accessToken = accessToken;
    this.merchantId = merchantId;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | undefined>
  ): Promise<T> {
    let fullPath = `${API_PATH_PREFIX}/merchant/${this.merchantId}${path}`;
    if (query) {
      const params = new URLSearchParams();
      for (const [key, val] of Object.entries(query)) {
        if (val !== undefined && val !== null && val !== "") {
          params.append(key, String(val));
        }
      }
      const qs = params.toString();
      if (qs) fullPath += `?${qs}`;
    }

    return new Promise<T>((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: API_BASE,
        path: fullPath,
        method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "X-Merchant-Id": this.merchantId,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            if (res.statusCode && res.statusCode >= 400) {
              const errMsg = parsed.error_description || parsed.message || `HTTP ${res.statusCode}`;
              reject(new Error(errMsg));
              return;
            }
            resolve(parsed as T);
          } catch {
            reject(new Error(`Failed to parse response: ${data.slice(0, 200)}`));
          }
        });
      });

      req.on("error", (err) => reject(new Error(`Request failed: ${err.message}`)));
      req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });

      if (body !== undefined) req.write(JSON.stringify(body));
      req.end();
    });
  }

  // ---- Articles ----
  async listArticles(params?: { limit?: number; page?: number; code?: string; identification_code?: string; article_type?: string; model_number?: string; updated_at_from?: string; updated_at_to?: string }) {
    return this.request<{ data: unknown[] }>("GET", "/articles", undefined, params as Record<string, string | number | undefined>);
  }
  async getArticle(id: string) { return this.request("GET", `/articles/${id}`); }
  async createArticle(article: Record<string, unknown>) { return this.request("POST", "/articles/new", { article }); }
  async bulkCreateArticles(articles: Record<string, unknown>[]) { return this.request("POST", "/articles/new/multiple", { articles }); }
  async updateArticle(id: string, article: Record<string, unknown>) { return this.request("PUT", `/articles/${id}`, { article }); }
  async deleteArticle(id: string) { return this.request("DELETE", `/articles/${id}/delete`); }

  // ---- Actual Inventory ----
  async listActualInventory(params?: Record<string, string | number | undefined>) {
    return this.request<{ data: unknown[] }>("GET", "/actual_inventory_summaries", undefined, params);
  }
  async searchActualInventory(body: { article_codes?: string[]; identification_codes?: string[]; model_numbers?: string[]; warehouse_id?: number }) {
    return this.request<{ data: unknown[] }>("POST", "/actual_inventory_summaries/search", body);
  }

  // ---- Logical Inventory ----
  async listLogicalInventory(params?: Record<string, string | number | undefined>) {
    return this.request<{ data: unknown[] }>("GET", "/logical_inventory_summaries", undefined, params);
  }
  async searchLogicalInventory(body: { article_codes?: string[]; identification_codes?: string[]; model_numbers?: string[]; warehouse_id?: number }) {
    return this.request<{ data: unknown[] }>("POST", "/logical_inventory_summaries/search", body);
  }

  // ---- Sales Orders ----
  async listSalesOrders(params?: Record<string, string | number | undefined>) {
    return this.request<{ data: unknown[] }>("GET", "/sales_orders", undefined, params);
  }
  async searchSalesOrders(body: { ids?: number[]; codes?: string[] }) { return this.request<{ data: unknown[] }>("POST", "/sales_orders/search", body); }
  async getSalesOrder(id: string) { return this.request("GET", `/sales_orders/${id}`); }
  async createSalesOrder(salesOrder: Record<string, unknown>) { return this.request("POST", "/sales_orders/new", { sales_order: salesOrder }); }
  async updateSalesOrder(id: string, salesOrder: Record<string, unknown>) { return this.request("PUT", `/sales_orders/${id}`, { sales_order: salesOrder }); }
  async cancelSalesOrder(id: string, clearsCode = false) { return this.request("POST", `/sales_orders/${id}/reversal`, { clears_code: clearsCode }); }
  async cancelSalesOrderLine(orderId: string, lineId: string) { return this.request("POST", `/sales_orders/${orderId}/sales_order_lines/${lineId}/reversal`); }

  // ---- Outbound Deliveries ----
  async listOutboundDeliveries(params?: Record<string, string | number | undefined>) {
    return this.request<{ data: unknown[] }>("GET", "/outbound_deliveries", undefined, params);
  }

  // ---- Master Data ----
  async listWarehouses() { return this.request<{ data: unknown[] }>("GET", "/warehouses"); }
  async listStores() { return this.request<{ data: unknown[] }>("GET", "/stores"); }
  async listLocations() { return this.request<{ data: unknown[] }>("GET", "/locations"); }
  async listSuppliers() { return this.request<{ data: unknown[] }>("GET", "/suppliers"); }
  async listArticleMaps() { return this.request<{ data: unknown[] }>("GET", "/article_maps"); }
  async listReorderPoints() { return this.request<{ data: unknown[] }>("GET", "/reorder_points"); }
  async listDailyInventorySummaries() { return this.request<{ data: unknown[] }>("GET", "/daily_inventory_summaries"); }
  async listTransactionLogs() { return this.request<{ data: unknown[] }>("GET", "/transaction_logs"); }
  async listInterWarehouseTransfers() { return this.request<{ data: unknown[] }>("GET", "/inter_warehouse_transfers"); }
  async listInboundDeliveries() { return this.request<{ data: unknown[] }>("GET", "/inbound_deliveries"); }
}
