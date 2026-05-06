#!/usr/bin/env node

/**
 * HTTP MCP Server for LOGILESS (ロジレス)
 *
 * Exposes logiless-mcp tools over HTTP for Claude Code and other MCP clients
 * that support HTTP/StreamableHTTP transport.
 *
 * Usage:
 *   export LOGILESS_ACCESS_TOKEN=xxx
 *   export LOGILESS_MERCHANT_ID=1234
 *   export LOGILESS_MCP_API_KEY=your-shared-secret
 *   node http-server.mjs
 *
 * Environment variables:
 *   LOGILESS_ACCESS_TOKEN  (required) OAuth2 access token
 *   LOGILESS_MERCHANT_ID   (required) Merchant ID
 *   LOGILESS_MCP_API_KEY   (required) Shared API key for authentication
 *   LOGILESS_MCP_PORT      (optional) HTTP server port (default: 3938)
 *
 * Caddy reverse proxy:
 *   handle_path /mcp/logiless/* {
 *       reverse_proxy 127.0.0.1:3938
 *   }
 *
 * Claude Code settings.json:
 *   {
 *     "mcpServers": {
 *       "logiless": {
 *         "url": "https://your-domain.com/mcp/logiless/mcp",
 *         "headers": { "X-API-Key": "your-shared-secret" }
 *       }
 *     }
 *   }
 */

import express from "express";
import { LogilessClient } from "./dist/client.js";

// ─── Config ────────────────────────────────────────────────
const PORT = parseInt(process.env.LOGILESS_MCP_PORT || "3938", 10);
const ACCESS_TOKEN = process.env.LOGILESS_ACCESS_TOKEN;
const MERCHANT_ID = process.env.LOGILESS_MERCHANT_ID;
const API_KEY = process.env.LOGILESS_MCP_API_KEY;

if (!ACCESS_TOKEN || !MERCHANT_ID) {
  console.error("Missing required env vars: LOGILESS_ACCESS_TOKEN, LOGILESS_MERCHANT_ID");
  process.exit(1);
}
if (!API_KEY) {
  console.error("Missing required env var: LOGILESS_MCP_API_KEY");
  process.exit(1);
}

const client = new LogilessClient(ACCESS_TOKEN, MERCHANT_ID);

// ─── Tool Definitions ──────────────────────────────────────
const ALL_TOOLS = [
  {
    name: "logiless_list_actual_inventory",
    description: "List actual (physical) inventory summaries. Supports filtering by article code, warehouse, layer, and update date range.",
    inputSchema: { type: "object", properties: { limit: { type: "number" }, page: { type: "number" }, article_code: { type: "string" }, warehouse_id: { type: "number" }, layer: { type: "string" }, updated_at_from: { type: "string" }, updated_at_to: { type: "string" } } },
  },
  {
    name: "logiless_search_actual_inventory",
    description: "Search actual inventory summaries by article codes, identification codes, or model numbers (max 100 each).",
    inputSchema: { type: "object", properties: { article_codes: { type: "array", items: { type: "string" } }, identification_codes: { type: "array", items: { type: "string" } }, model_numbers: { type: "array", items: { type: "string" } }, warehouse_id: { type: "number" } } },
  },
  {
    name: "logiless_list_logical_inventory",
    description: "List logical inventory summaries. Shows ordered, in-transit, available, allocated, free, stock-out quantities. Supports reorder-level filtering.",
    inputSchema: { type: "object", properties: { limit: { type: "number" }, page: { type: "number" }, article_code: { type: "string" }, warehouse_id: { type: "number" }, layer: { type: "string" }, is_reorder_level: { type: "number" }, updated_at_from: { type: "string" }, updated_at_to: { type: "string" } } },
  },
  {
    name: "logiless_search_logical_inventory",
    description: "Search logical inventory summaries by article codes, identification codes, or model numbers (max 100 each).",
    inputSchema: { type: "object", properties: { article_codes: { type: "array", items: { type: "string" } }, identification_codes: { type: "array", items: { type: "string" } }, model_numbers: { type: "array", items: { type: "string" } }, warehouse_id: { type: "number" } } },
  },
  {
    name: "logiless_list_daily_inventory",
    description: "List daily inventory summaries. Requires date (Y-m-d).",
    inputSchema: { type: "object", properties: { date: { type: "string" }, warehouse: { type: "number" }, article_code: { type: "string" }, limit: { type: "number" }, page: { type: "number" } }, required: ["date"] },
  },
  {
    name: "logiless_list_articles",
    description: "List articles (product master). Supports filtering by code, type, model number, and update date.",
    inputSchema: { type: "object", properties: { limit: { type: "number" }, page: { type: "number" }, code: { type: "string" }, article_type: { type: "string" }, model_number: { type: "string" }, updated_at_from: { type: "string" }, updated_at_to: { type: "string" } } },
  },
  {
    name: "logiless_get_article",
    description: "Get a single article (product) by its numeric ID.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "logiless_create_article",
    description: "Create a new article (product). Required: code, name.",
    inputSchema: { type: "object", properties: { code: { type: "string" }, name: { type: "string" }, price: { type: "number" }, tags: { type: "array", items: { type: "string" } } }, required: ["code", "name"] },
  },
  {
    name: "logiless_bulk_create_articles",
    description: "Bulk create articles (max 100 at once). Each item needs code and name.",
    inputSchema: { type: "object", properties: { articles: { type: "array", items: { type: "object", properties: { code: { type: "string" }, name: { type: "string" } }, required: ["code", "name"] } } }, required: ["articles"] },
  },
  {
    name: "logiless_update_article",
    description: "Update an existing article. Only include fields you want to change.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, price: { type: "number" } }, required: ["id"] },
  },
  {
    name: "logiless_delete_article",
    description: "Delete an article by ID. ⚠️ Irreversible.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "logiless_list_sales_orders",
    description: "List sales orders with rich filtering by status, date range, store, etc.",
    inputSchema: { type: "object", properties: { limit: { type: "number" }, page: { type: "number" }, code: { type: "string" }, document_status: { type: "string" }, delivery_status: { type: "string" }, store: { type: "number" }, ordered_at_from: { type: "string" }, ordered_at_to: { type: "string" }, updated_at_from: { type: "string" }, updated_at_to: { type: "string" } } },
  },
  {
    name: "logiless_search_sales_orders",
    description: "Search sales orders by multiple IDs or codes (max 100 each).",
    inputSchema: { type: "object", properties: { ids: { type: "array", items: { type: "number" } }, codes: { type: "array", items: { type: "string" } } } },
  },
  {
    name: "logiless_get_sales_order",
    description: "Get a single sales order by ID. Returns full details including lines, outbound deliveries, store info.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "logiless_create_sales_order",
    description: "Create a new sales order. Requires: code, buyer_name1, recipient info, payment_method, delivery_method, lines, and store ID.",
    inputSchema: { type: "object", properties: { code: { type: "string" }, buyer_name1: { type: "string" }, recipient_name1: { type: "string" }, recipient_address1: { type: "string" }, payment_method: { type: "string" }, delivery_method: { type: "string" }, store: { type: "number" }, lines: { type: "array", items: { type: "object", properties: { article_code: { type: "string" }, article_name: { type: "string" }, quantity: { type: "number" } }, required: ["article_code", "article_name", "quantity"] } } }, required: ["code", "buyer_name1", "recipient_name1", "recipient_address1", "payment_method", "delivery_method", "store", "lines"] },
  },
  {
    name: "logiless_update_sales_order",
    description: "Update a sales order. Cannot change order code.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, tags: { type: "array", items: { type: "string" } } }, required: ["id"] },
  },
  {
    name: "logiless_cancel_sales_order",
    description: "Cancel a sales order. Sets document_status to Cancel.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, clears_code: { type: "boolean" } }, required: ["id"] },
  },
  {
    name: "logiless_cancel_sales_order_line",
    description: "Cancel a single line item within a sales order. Partial cancellation.",
    inputSchema: { type: "object", properties: { order_id: { type: "string" }, line_id: { type: "string" } }, required: ["order_id", "line_id"] },
  },
  {
    name: "logiless_list_outbound_deliveries",
    description: "List outbound (shipping) deliveries. Read-only — these are auto-generated from sales orders.",
    inputSchema: { type: "object", properties: { limit: { type: "number" }, page: { type: "number" }, warehouse: { type: "number" }, store: { type: "number" }, updated_at_from: { type: "string" }, updated_at_to: { type: "string" } } },
  },
  {
    name: "logiless_list_warehouses",
    description: "List all warehouses.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "logiless_list_stores",
    description: "List all stores/channels.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "logiless_list_locations",
    description: "List locations within a warehouse. Requires warehouse_id.",
    inputSchema: { type: "object", properties: { warehouse_id: { type: "number" } }, required: ["warehouse_id"] },
  },
  {
    name: "logiless_list_suppliers",
    description: "List suppliers (仕入先).",
    inputSchema: { type: "object", properties: { limit: { type: "number" }, page: { type: "number" }, code: { type: "string" }, updated_at_from: { type: "string" }, updated_at_to: { type: "string" } } },
  },
  {
    name: "logiless_list_article_maps",
    description: "List article-to-store mappings.",
    inputSchema: { type: "object", properties: { limit: { type: "number" }, page: { type: "number" }, store: { type: "number" }, article_code: { type: "string" } } },
  },
  {
    name: "logiless_list_reorder_points",
    description: "List reorder points (発注点) configuration.",
    inputSchema: { type: "object", properties: { limit: { type: "number" }, page: { type: "number" }, article_code: { type: "string" }, warehouse_id: { type: "number" }, is_reorder_level: { type: "number" } } },
  },
  {
    name: "logiless_list_transaction_logs",
    description: "List transaction/log entries.",
    inputSchema: { type: "object", properties: { limit: { type: "number" }, page: { type: "number" }, transaction_type: { type: "string" }, article_code: { type: "string" }, warehouse_id: { type: "number" }, created_at_from: { type: "string" }, created_at_to: { type: "string" } } },
  },
  {
    name: "logiless_list_inter_warehouse_transfers",
    description: "List inter-warehouse transfers.",
    inputSchema: { type: "object", properties: { limit: { type: "number" }, page: { type: "number" }, document_status: { type: "string" }, warehouse: { type: "number" }, destination: { type: "number" } } },
  },
  {
    name: "logiless_list_inbound_deliveries",
    description: "List inbound deliveries (入荷配送).",
    inputSchema: { type: "object", properties: { limit: { type: "number" }, page: { type: "number" }, status: { type: "string" }, warehouse: { type: "number" } } },
  },
];

// ─── Express App ───────────────────────────────────────────
const app = express();
app.use(express.json());

// API Key authentication
app.use((req, res, next) => {
  const provided = req.headers["x-api-key"] || req.query.api_key;
  if (!provided || provided !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized. Provide X-API-Key header." });
  }
  next();
});

// POST /mcp — MCP endpoint
app.post("/mcp", async (req, res) => {
  const { method, id, params } = req.body;

  try {
    if (method === "list_tools" || method === "tools/list") {
      return res.json({ jsonrpc: "2.0", id, result: { tools: ALL_TOOLS } });
    }

    if (method === "call_tool" || method === "tools/call") {
      const { name, arguments: args } = params || {};

      try {
        let result;

        switch (name) {
          case "logiless_list_actual_inventory":
            result = await client.listActualInventory(buildParams(args, { limit: "n", page: "n", article_code: "s", warehouse_id: "n", layer: "s", updated_at_from: "s", updated_at_to: "s" }));
            break;
          case "logiless_search_actual_inventory":
            result = await client.searchActualInventory({ article_codes: args?.article_codes, identification_codes: args?.identification_codes, model_numbers: args?.model_numbers, warehouse_id: args?.warehouse_id });
            break;
          case "logiless_list_logical_inventory":
            result = await client.listLogicalInventory(buildParams(args, { limit: "n", page: "n", article_code: "s", warehouse_id: "n", layer: "s", is_reorder_level: "n", updated_at_from: "s", updated_at_to: "s" }));
            break;
          case "logiless_search_logical_inventory":
            result = await client.searchLogicalInventory({ article_codes: args?.article_codes, identification_codes: args?.identification_codes, model_numbers: args?.model_numbers, warehouse_id: args?.warehouse_id });
            break;
          case "logiless_list_daily_inventory":
            result = await client.listDailyInventorySummaries(args?.date, buildParams(args, { warehouse: "n", article_code: "s", limit: "n", page: "n" }));
            break;
          case "logiless_list_articles":
            result = await client.listArticles(buildParams(args, { limit: "n", page: "n", code: "s", article_type: "s", model_number: "s", updated_at_from: "s", updated_at_to: "s" }));
            break;
          case "logiless_get_article":
            result = await client.getArticle(String(args?.id));
            break;
          case "logiless_create_article":
            result = await client.createArticle(args);
            break;
          case "logiless_bulk_create_articles":
            result = await client.bulkCreateArticles(args?.articles);
            break;
          case "logiless_update_article":
            result = await client.updateArticle(String(args?.id), args);
            break;
          case "logiless_delete_article":
            result = await client.deleteArticle(String(args?.id));
            break;
          case "logiless_list_sales_orders":
            result = await client.listSalesOrders(buildParams(args, { limit: "n", page: "n", code: "s", document_status: "s", delivery_status: "s", store: "n", ordered_at_from: "s", ordered_at_to: "s", updated_at_from: "s", updated_at_to: "s" }));
            break;
          case "logiless_search_sales_orders":
            result = await client.searchSalesOrders({ ids: args?.ids, codes: args?.codes });
            break;
          case "logiless_get_sales_order":
            result = await client.getSalesOrder(String(args?.id));
            break;
          case "logiless_create_sales_order": {
            const { lines, store, ...rest } = args;
            result = await client.createSalesOrder({ ...rest, store: Number(store), lines });
            break;
          }
          case "logiless_update_sales_order": {
            const { id, ...updates } = args;
            result = await client.updateSalesOrder(String(args?.id), updates);
            break;
          }
          case "logiless_cancel_sales_order":
            result = await client.cancelSalesOrder(String(args?.id), Boolean(args?.clears_code));
            break;
          case "logiless_cancel_sales_order_line":
            result = await client.cancelSalesOrderLine(String(args?.order_id), String(args?.line_id));
            break;
          case "logiless_list_outbound_deliveries":
            result = await client.listOutboundDeliveries(buildParams(args, { limit: "n", page: "n", warehouse: "n", store: "n", updated_at_from: "s", updated_at_to: "s" }));
            break;
          case "logiless_list_warehouses":
            result = await client.listWarehouses();
            break;
          case "logiless_list_stores":
            result = await client.listStores();
            break;
          case "logiless_list_locations":
            result = await client.listLocations(Number(args?.warehouse_id));
            break;
          case "logiless_list_suppliers":
            result = await client.listSuppliers(args);
            break;
          case "logiless_list_article_maps":
            result = await client.listArticleMaps(args);
            break;
          case "logiless_list_reorder_points":
            result = await client.listReorderPoints(args);
            break;
          case "logiless_list_transaction_logs":
            result = await client.listTransactionLogs(args);
            break;
          case "logiless_list_inter_warehouse_transfers":
            result = await client.listInterWarehouseTransfers(args);
            break;
          case "logiless_list_inbound_deliveries":
            result = await client.listInboundDeliveries(args);
            break;
          default:
            return res.json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Tool not found: ${name}` } });
        }

        return res.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
      } catch (err) {
        return res.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true } });
      }
    }

    return res.json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
  } catch (err) {
    return res.status(500).json({ jsonrpc: "2.0", id, error: { code: -32603, message: err.message } });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", tools: ALL_TOOLS.length });
});

// ─── Helper ─────────────────────────────────────────────────
function buildParams(args, fields) {
  const params = {};
  for (const [key, type] of Object.entries(fields)) {
    const val = args?.[key];
    if (val !== undefined && val !== null && val !== "") {
      if (type === "n") params[key] = Number(val);
      else params[key] = String(val);
    }
  }
  return params;
}

// ─── Start ──────────────────────────────────────────────────
app.listen(PORT, "127.0.0.1", () => {
  console.error(`Logiless HTTP MCP server listening on http://127.0.0.1:${PORT}`);
  console.error(`Tools registered: ${ALL_TOOLS.length}`);
});
