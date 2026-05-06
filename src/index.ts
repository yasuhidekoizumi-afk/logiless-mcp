#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { LogilessClient } from "./client.js";

// ─── Environment ────────────────────────────────────────────
const ACCESS_TOKEN = process.env.LOGILESS_ACCESS_TOKEN;
const MERCHANT_ID = process.env.LOGILESS_MERCHANT_ID;

if (!ACCESS_TOKEN || !MERCHANT_ID) {
  console.error("Missing required env vars: LOGILESS_ACCESS_TOKEN, LOGILESS_MERCHANT_ID");
  process.exit(1);
}

const client = new LogilessClient(ACCESS_TOKEN, MERCHANT_ID);

// ─── MCP Server ─────────────────────────────────────────────
const server = new Server(
  { name: "logiless-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// ─── Tool Definitions ───────────────────────────────────────
const ALL_TOOLS = [
  // Inventory
  {
    name: "logiless_list_actual_inventory",
    description: "List actual (physical) inventory summaries. Supports filtering by article code, warehouse, layer, and update date range.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (default: 20, max: 100)" },
        page: { type: "number", description: "Page number (default: 1)" },
        article_code: { type: "string", description: "Filter by article code (single value)" },
        warehouse_id: { type: "number", description: "Filter by warehouse ID" },
        layer: { type: "string", description: "Inventory layer: Article, Sku, or Location" },
        updated_at_from: { type: "string", description: "Updated from (Y-m-d H:i:s). Required to see zero-quantity records." },
        updated_at_to: { type: "string", description: "Updated to (Y-m-d H:i:s)" },
      },
    },
  },
  {
    name: "logiless_search_actual_inventory",
    description: "Search actual inventory summaries by article codes, identification codes, or model numbers (max 100 each).",
    inputSchema: {
      type: "object",
      properties: {
        article_codes: { type: "array", items: { type: "string" }, description: "Article codes to search (max 100)" },
        identification_codes: { type: "array", items: { type: "string" }, description: "Identification codes (max 100)" },
        model_numbers: { type: "array", items: { type: "string" }, description: "Model numbers (max 100)" },
        warehouse_id: { type: "number", description: "Filter by warehouse ID" },
      },
      required: [],
    },
  },
  {
    name: "logiless_list_logical_inventory",
    description: "List logical inventory summaries. Shows ordered, in-transit, available, allocated, free, stock-out quantities. Supports reorder-level filtering.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (default: 20, max: 100)" },
        page: { type: "number", description: "Page number (default: 1)" },
        article_code: { type: "string", description: "Filter by article code (single value)" },
        warehouse_id: { type: "number", description: "Filter by warehouse ID" },
        layer: { type: "string", description: "Inventory layer: Article, Sku, or Location" },
        is_reorder_level: { type: "number", description: "1 = only items below reorder point" },
        updated_at_from: { type: "string", description: "Updated from (Y-m-d H:i:s)" },
        updated_at_to: { type: "string", description: "Updated to (Y-m-d H:i:s)" },
      },
    },
  },
  {
    name: "logiless_search_logical_inventory",
    description: "Search logical inventory summaries by article codes, identification codes, or model numbers (max 100 each).",
    inputSchema: {
      type: "object",
      properties: {
        article_codes: { type: "array", items: { type: "string" }, description: "Article codes to search (max 100)" },
        identification_codes: { type: "array", items: { type: "string" }, description: "Identification codes (max 100)" },
        model_numbers: { type: "array", items: { type: "string" }, description: "Model numbers (max 100)" },
        warehouse_id: { type: "number", description: "Filter by warehouse ID" },
      },
      required: [],
    },
  },
  {
    name: "logiless_list_daily_inventory",
    description: "List daily inventory summaries. Historical snapshot of inventory levels per day.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // Articles
  {
    name: "logiless_list_articles",
    description: "List articles (product master). Supports filtering by code, type, model number, and update date.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (default: 20, max: 100)" },
        page: { type: "number", description: "Page number (default: 1)" },
        code: { type: "string", description: "Filter by article code" },
        article_type: { type: "string", description: "Filter by article type (Single, Assortment)" },
        model_number: { type: "string", description: "Filter by model number" },
        updated_at_from: { type: "string", description: "Updated from (Y-m-d H:i:s)" },
        updated_at_to: { type: "string", description: "Updated to (Y-m-d H:i:s)" },
      },
    },
  },
  {
    name: "logiless_get_article",
    description: "Get a single article (product) by its numeric ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Article ID (numeric)" },
      },
      required: ["id"],
    },
  },
  {
    name: "logiless_create_article",
    description: "Create a new article (product). Required: code, name. Optional: price, cost, weight, dimensions, tags, article_type, etc.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Article code (required)" },
        name: { type: "string", description: "Article name (required)" },
        article_type: { type: "string", description: "Article type: Single or Assortment" },
        price: { type: "number", description: "Price" },
        cost: { type: "number", description: "Cost" },
        weight: { type: "number", description: "Weight" },
        width: { type: "number", description: "Width" },
        height: { type: "number", description: "Height" },
        depth: { type: "number", description: "Depth" },
        model_number: { type: "string", description: "Model number" },
        temperature_control: { type: "string", description: "Temperature control: Normal, Refrigerated, Frozen" },
        tags: { type: "array", items: { type: "string" }, description: "Tags" },
      },
      required: ["code", "name"],
    },
  },
  {
    name: "logiless_bulk_create_articles",
    description: "Bulk create articles (max 100 at once). Each item needs code and name.",
    inputSchema: {
      type: "object",
      properties: {
        articles: {
          type: "array",
          items: {
            type: "object",
            properties: {
              code: { type: "string", description: "Article code" },
              name: { type: "string", description: "Article name" },
              price: { type: "number", description: "Price" },
            },
            required: ["code", "name"],
          },
          description: "Array of articles to create (max 100)",
        },
      },
      required: ["articles"],
    },
  },
  {
    name: "logiless_update_article",
    description: "Update an existing article. Only include fields you want to change.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Article ID" },
        name: { type: "string", description: "Article name" },
        price: { type: "number", description: "Price" },
        cost: { type: "number", description: "Cost" },
        weight: { type: "number", description: "Weight" },
        tags: { type: "array", items: { type: "string" }, description: "Tags" },
        temperature_control: { type: "string", description: "Temperature control" },
      },
      required: ["id"],
    },
  },
  {
    name: "logiless_delete_article",
    description: "Delete an article by ID. ⚠️ Irreversible.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Article ID to delete" },
      },
      required: ["id"],
    },
  },

  // Sales Orders
  {
    name: "logiless_list_sales_orders",
    description: "List sales orders with rich filtering by status, date range, store, etc.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (default: 20, max: 100)" },
        page: { type: "number", description: "Page number (default: 1)" },
        code: { type: "string", description: "Filter by order code (single value)" },
        document_status: { type: "string", description: "Comma-separated statuses: WaitingForAllocation, PartiallyAllocated, Allocated, Cancel" },
        delivery_status: { type: "string", description: "Comma-separated: WaitingForShipment, Shipped, Cancel" },
        allocation_status: { type: "string", description: "Comma-separated: WaitingForAllocation, PartiallyAllocated, Allocated" },
        store: { type: "number", description: "Filter by store ID" },
        ordered_at_from: { type: "string", description: "Order date from (Y-m-d H:i:s)" },
        ordered_at_to: { type: "string", description: "Order date to (Y-m-d H:i:s)" },
        updated_at_from: { type: "string", description: "Updated from (Y-m-d H:i:s)" },
        updated_at_to: { type: "string", description: "Updated to (Y-m-d H:i:s)" },
        scheduled_shipping_date_from: { type: "string", description: "Scheduled shipping from (Y-m-d)" },
        scheduled_shipping_date_to: { type: "string", description: "Scheduled shipping to (Y-m-d)" },
      },
    },
  },
  {
    name: "logiless_search_sales_orders",
    description: "Search sales orders by multiple IDs or codes (max 100 each).",
    inputSchema: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "number" }, description: "Order IDs (max 100)" },
        codes: { type: "array", items: { type: "string" }, description: "Order codes (max 100)" },
      },
      required: [],
    },
  },
  {
    name: "logiless_get_sales_order",
    description: "Get a single sales order by ID. Returns full details including lines, outbound deliveries, store info.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Sales order ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "logiless_create_sales_order",
    description: "Create a new sales order. Requires: code, buyer_name1, recipient info, payment_method, delivery_method, lines (with article_code, article_name, quantity), and store ID.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Order code (required)" },
        buyer_name1: { type: "string", description: "Buyer name (required)" },
        buyer_email: { type: "string", description: "Buyer email" },
        recipient_name1: { type: "string", description: "Recipient name (required)" },
        recipient_post_code: { type: "string", description: "Recipient postal code" },
        recipient_prefecture: { type: "string", description: "Recipient prefecture" },
        recipient_address1: { type: "string", description: "Recipient address line 1 (required)" },
        recipient_address2: { type: "string", description: "Recipient address line 2" },
        recipient_address3: { type: "string", description: "Recipient address line 3" },
        recipient_phone: { type: "string", description: "Recipient phone" },
        payment_method: { type: "string", description: "Payment method (required). e.g. credit_card_payment, cash_on_delivery" },
        delivery_method: { type: "string", description: "Delivery method (required). e.g. yamato, yuupack" },
        delivery_fee: { type: "number", description: "Delivery fee" },
        ordered_at: { type: "string", description: "Order date/time (Y-m-d H:i:s)" },
        tags: { type: "array", items: { type: "string" }, description: "Order tags" },
        store: { type: "number", description: "Store ID (required)" },
        warehouse: { type: "number", description: "Warehouse ID for shipping" },
        scheduled_shipping_date: { type: "string", description: "Scheduled shipping date (Y-m-d)" },
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              article_code: { type: "string", description: "Article code" },
              article_name: { type: "string", description: "Article name" },
              price: { type: "number", description: "Unit price" },
              quantity: { type: "number", description: "Quantity" },
            },
            required: ["article_code", "article_name", "quantity"],
          },
          description: "Order line items (required)",
        },
      },
      required: ["code", "buyer_name1", "recipient_name1", "recipient_address1", "payment_method", "delivery_method", "store", "lines"],
    },
  },
  {
    name: "logiless_update_sales_order",
    description: "Update a sales order. Only include fields you want to change. Cannot change order code.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Sales order ID" },
        authorization_status: { type: "string", description: "Authorization status" },
        recipient_name1: { type: "string", description: "Recipient name" },
        recipient_address1: { type: "string", description: "Recipient address" },
        delivery_fee: { type: "number", description: "Delivery fee" },
        merchant_comment: { type: "string", description: "Merchant notes" },
        tags: { type: "array", items: { type: "string" }, description: "Tags" },
      },
      required: ["id"],
    },
  },
  {
    name: "logiless_cancel_sales_order",
    description: "Cancel a sales order. Sets document_status to Cancel. Optionally allow reusing the order code.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Sales order ID to cancel" },
        clears_code: { type: "boolean", description: "Allow reusing the same order code for new orders (default: false)" },
      },
      required: ["id"],
    },
  },
  {
    name: "logiless_cancel_sales_order_line",
    description: "Cancel a single line item within a sales order. Partial cancellation.",
    inputSchema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "Sales order ID" },
        line_id: { type: "string", description: "Line item ID to cancel" },
      },
      required: ["order_id", "line_id"],
    },
  },

  // Outbound Deliveries (read-only)
  {
    name: "logiless_list_outbound_deliveries",
    description: "List outbound (shipping) deliveries. Read-only — these are auto-generated from sales orders. Supports filtering by status, date, warehouse, store.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (default: 20, max: 100)" },
        page: { type: "number", description: "Page number (default: 1)" },
        document_status: { type: "string", description: "Comma-separated statuses" },
        delivery_status: { type: "string", description: "Comma-separated delivery statuses" },
        warehouse: { type: "number", description: "Filter by warehouse ID" },
        store: { type: "number", description: "Filter by store ID" },
        updated_at_from: { type: "string", description: "Updated from (Y-m-d H:i:s)" },
        updated_at_to: { type: "string", description: "Updated to (Y-m-d H:i:s)" },
        scheduled_shipping_date_from: { type: "string", description: "Scheduled shipping from (Y-m-d)" },
        scheduled_shipping_date_to: { type: "string", description: "Scheduled shipping to (Y-m-d)" },
      },
    },
  },

  // Master Data
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
    description: "List all warehouse locations.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "logiless_list_suppliers",
    description: "List all suppliers.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "logiless_list_article_maps",
    description: "List article-to-store mappings (connect store article codes to Logiless article codes).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "logiless_list_reorder_points",
    description: "List reorder points (発注点) configuration.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "logiless_list_transaction_logs",
    description: "List transaction/log entries.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "logiless_list_inter_warehouse_transfers",
    description: "List inter-warehouse transfers.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "logiless_list_inbound_deliveries",
    description: "List inbound deliveries (入荷配送).",
    inputSchema: { type: "object", properties: {} },
  },
];

// ─── Tool Handlers ──────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ALL_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Helper: args lookup with default
  const n = (key: string, def?: number): number | undefined => {
    const v = args?.[key];
    return v !== undefined ? Number(v) : def;
  };
  const s = (key: string): string | undefined => args?.[key] as string | undefined;
  const a = (key: string): unknown[] | undefined => args?.[key] as unknown[] | undefined;

  try {
    let result: unknown;

    switch (name) {
      // ── Inventory ──
      case "logiless_list_actual_inventory":
        result = await client.listActualInventory({
          limit: n("limit"), page: n("page"),
          article_code: s("article_code"), warehouse_id: n("warehouse_id"),
          layer: s("layer"), updated_at_from: s("updated_at_from"),
          updated_at_to: s("updated_at_to"),
        });
        break;
      case "logiless_search_actual_inventory":
        result = await client.searchActualInventory({
          article_codes: a("article_codes") as string[],
          identification_codes: a("identification_codes") as string[],
          model_numbers: a("model_numbers") as string[],
          warehouse_id: n("warehouse_id"),
        });
        break;
      case "logiless_list_logical_inventory":
        result = await client.listLogicalInventory({
          limit: n("limit"), page: n("page"),
          article_code: s("article_code"), warehouse_id: n("warehouse_id"),
          layer: s("layer"), is_reorder_level: n("is_reorder_level"),
          updated_at_from: s("updated_at_from"), updated_at_to: s("updated_at_to"),
        });
        break;
      case "logiless_search_logical_inventory":
        result = await client.searchLogicalInventory({
          article_codes: a("article_codes") as string[],
          identification_codes: a("identification_codes") as string[],
          model_numbers: a("model_numbers") as string[],
          warehouse_id: n("warehouse_id"),
        });
        break;
      case "logiless_list_daily_inventory":
        result = await client.listDailyInventorySummaries();
        break;

      // ── Articles ──
      case "logiless_list_articles":
        result = await client.listArticles({
          limit: n("limit"), page: n("page"),
          code: s("code"), article_type: s("article_type"),
          model_number: s("model_number"),
          updated_at_from: s("updated_at_from"), updated_at_to: s("updated_at_to"),
        });
        break;
      case "logiless_get_article":
        result = await client.getArticle(s("id")!);
        break;
      case "logiless_create_article":
        result = await client.createArticle(args as Record<string, unknown>);
        break;
      case "logiless_bulk_create_articles":
        result = await client.bulkCreateArticles(a("articles") as Record<string, unknown>[]);
        break;
      case "logiless_update_article":
        result = await client.updateArticle(s("id")!, args as Record<string, unknown>);
        break;
      case "logiless_delete_article":
        result = await client.deleteArticle(s("id")!);
        break;

      // ── Sales Orders ──
      case "logiless_list_sales_orders":
        result = await client.listSalesOrders({
          limit: n("limit"), page: n("page"),
          code: s("code"), document_status: s("document_status"),
          delivery_status: s("delivery_status"), allocation_status: s("allocation_status"),
          store: n("store"),
          ordered_at_from: s("ordered_at_from"), ordered_at_to: s("ordered_at_to"),
          updated_at_from: s("updated_at_from"), updated_at_to: s("updated_at_to"),
          scheduled_shipping_date_from: s("scheduled_shipping_date_from"),
          scheduled_shipping_date_to: s("scheduled_shipping_date_to"),
        });
        break;
      case "logiless_search_sales_orders":
        result = await client.searchSalesOrders({
          ids: a("ids") as number[],
          codes: a("codes") as string[],
        });
        break;
      case "logiless_get_sales_order":
        result = await client.getSalesOrder(s("id")!);
        break;
      case "logiless_create_sales_order": {
        const { lines, store, ...rest } = args as Record<string, unknown>;
        result = await client.createSalesOrder({
          ...rest,
          store: Number(store),
          lines: lines as unknown[],
        });
        break;
      }
      case "logiless_update_sales_order": {
        const { id, ...updates } = args as Record<string, unknown>;
        result = await client.updateSalesOrder(s("id")!, updates);
        break;
      }
      case "logiless_cancel_sales_order":
        result = await client.cancelSalesOrder(s("id")!, Boolean(args?.clears_code));
        break;
      case "logiless_cancel_sales_order_line":
        result = await client.cancelSalesOrderLine(s("order_id")!, s("line_id")!);
        break;

      // ── Outbound ──
      case "logiless_list_outbound_deliveries":
        result = await client.listOutboundDeliveries({
          limit: n("limit"), page: n("page"),
          document_status: s("document_status"), delivery_status: s("delivery_status"),
          warehouse: n("warehouse"), store: n("store"),
          updated_at_from: s("updated_at_from"), updated_at_to: s("updated_at_to"),
          scheduled_shipping_date_from: s("scheduled_shipping_date_from"),
          scheduled_shipping_date_to: s("scheduled_shipping_date_to"),
        });
        break;

      // ── Master Data ──
      case "logiless_list_warehouses": result = await client.listWarehouses(); break;
      case "logiless_list_stores": result = await client.listStores(); break;
      case "logiless_list_locations": result = await client.listLocations(); break;
      case "logiless_list_suppliers": result = await client.listSuppliers(); break;
      case "logiless_list_article_maps": result = await client.listArticleMaps(); break;
      case "logiless_list_reorder_points": result = await client.listReorderPoints(); break;
      case "logiless_list_transaction_logs": result = await client.listTransactionLogs(); break;
      case "logiless_list_inter_warehouse_transfers": result = await client.listInterWarehouseTransfers(); break;
      case "logiless_list_inbound_deliveries": result = await client.listInboundDeliveries(); break;

      default:
        return {
          content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: `Error: ${msg}` }],
      isError: true,
    };
  }
});

// ─── Start ──────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Logiless MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
