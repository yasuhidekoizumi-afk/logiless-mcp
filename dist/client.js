import https from "node:https";
const API_BASE = "app2.logiless.com";
const API_PATH_PREFIX = "/api/v1";
export class LogilessClient {
  constructor(accessToken, merchantId) {
    this.accessToken = accessToken;
    this.merchantId = merchantId;
  }
  async request(method, path, body, query) {
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
    return new Promise((resolve, reject) => {
      const options = {
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
        res.on("data", (chunk) => { data += chunk.toString(); });
        res.on("end", () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            if (res.statusCode && res.statusCode >= 400) {
              const errMsg = parsed.error_description || parsed.message || `HTTP ${res.statusCode}`;
              reject(new Error(errMsg));
              return;
            }
            resolve(parsed);
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
  async listArticles(params) { return this.request("GET", "/articles", undefined, params); }
  async getArticle(id) { return this.request("GET", `/articles/${id}`); }
  async createArticle(article) { return this.request("POST", "/articles/new", { article }); }
  async bulkCreateArticles(articles) { return this.request("POST", "/articles/new/multiple", { articles }); }
  async updateArticle(id, article) { return this.request("PUT", `/articles/${id}`, { article }); }
  async deleteArticle(id) { return this.request("DELETE", `/articles/${id}/delete`); }
  async listActualInventory(params) { return this.request("GET", "/actual_inventory_summaries", undefined, params); }
  async searchActualInventory(body) { return this.request("POST", "/actual_inventory_summaries/search", body); }
  async listLogicalInventory(params) { return this.request("GET", "/logical_inventory_summaries", undefined, params); }
  async searchLogicalInventory(body) { return this.request("POST", "/logical_inventory_summaries/search", body); }
  async listSalesOrders(params) { return this.request("GET", "/sales_orders", undefined, params); }
  async searchSalesOrders(body) { return this.request("POST", "/sales_orders/search", body); }
  async getSalesOrder(id) { return this.request("GET", `/sales_orders/${id}`); }
  async createSalesOrder(salesOrder) { return this.request("POST", "/sales_orders/new", { sales_order: salesOrder }); }
  async updateSalesOrder(id, salesOrder) { return this.request("PUT", `/sales_orders/${id}`, { sales_order: salesOrder }); }
  async cancelSalesOrder(id, clearsCode = false) { return this.request("POST", `/sales_orders/${id}/reversal`, { clears_code: clearsCode }); }
  async cancelSalesOrderLine(orderId, lineId) { return this.request("POST", `/sales_orders/${orderId}/sales_order_lines/${lineId}/reversal`); }
  async listOutboundDeliveries(params) { return this.request("GET", "/outbound_deliveries", undefined, params); }
  async listWarehouses() { return this.request("GET", "/warehouses"); }
  async listStores() { return this.request("GET", "/stores"); }
  async listLocations() { return this.request("GET", "/locations"); }
  async listSuppliers() { return this.request("GET", "/suppliers"); }
  async listArticleMaps() { return this.request("GET", "/article_maps"); }
  async listReorderPoints() { return this.request("GET", "/reorder_points"); }
  async listDailyInventorySummaries() { return this.request("GET", "/daily_inventory_summaries"); }
  async listTransactionLogs() { return this.request("GET", "/transaction_logs"); }
  async listInterWarehouseTransfers() { return this.request("GET", "/inter_warehouse_transfers"); }
  async listInboundDeliveries() { return this.request("GET", "/inbound_deliveries"); }
}