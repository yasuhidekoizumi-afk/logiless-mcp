#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { LogilessClient } from "./client.js";

const ACCESS_TOKEN = process.env.LOGILESS_ACCESS_TOKEN;
const MERCHANT_ID = process.env.LOGILESS_MERCHANT_ID;
if (!ACCESS_TOKEN || !MERCHANT_ID) {
  console.error("Missing required env vars: LOGILESS_ACCESS_TOKEN, LOGILESS_MERCHANT_ID");
  process.exit(1);
}
const client = new LogilessClient(ACCESS_TOKEN, MERCHANT_ID);

const server = new Server(
  { name: "logiless-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

const ALL_TOOLS = [
  { name: "logiless_list_actual_inventory", description: "List actual (physical) inventory summaries.", inputSchema: { type: "object", properties: { limit: { type: "number" }, page: { type: "number" }, article_code: { type: "string" }, warehouse_id: { type: "number" }, layer: { type: "string" }, updated_at_from: { type: "string" }, updated_at_to: { type: "string" } } } },
  { name: "logiless_search_actual_inventory", description: "Search actual inventory by article codes, identification codes, or model numbers.", inputSchema: { type: "object", properties: { article_codes: { type: "array", items: { type: "string" } }, identification_codes: { type: "array", items: { type: "string" } }, model_numbers: { type: "array", items: { type: "string" } }, warehouse_id: { type: "number" } } } },
  { name: "logiless_list_logical_inventory", description: "List logical inventory summaries.", inputSchema: { type: "object", properties: { limit: { type: "number" }, page: { type: "number" }, article_code: { type: "string" }, warehouse_id: { type: "number" }, is_reorder_level: { type: "number" }, updated_at_from: { type: "string" }, updated_at_to: { type: "string" } } } },
  { name: "logiless_search_logical_inventory", description: "Search logical inventory by article codes, identification codes, or model numbers.", inputSchema: { type: "object", properties: { article_codes: { type: "array", items: { type: "string" } }, identification_codes: { type: "array", items: { type: "string" } }, model_numbers: { type: "array", items: { type: "string" } }, warehouse_id: { type: "number" } } } },
  { name: "logiless_list_daily_inventory", description: "List daily inventory summaries.", inputSchema: { type: "object", properties: {} } },
  { name: "logiless_list_articles", description: "List articles (product master).", inputSchema: { type: "object", properties: { limit: { type: "number" }, page: { type: "number" }, code: { type: "string" }, article_type: { type: "string" }, model_number: { type: "string" }, updated_at_from: { type: "string" }, updated_at_to: { type: "string" } } } },
  { name: "logiless_get_article", description: "Get a single article by ID.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "logiless_create_article", description: "Create a new article.", inputSchema: { type: "object", properties: { code: { type: "string" }, name: { type: "string" }, price: { type: "number" }, tags: { type: "array", items: { type: "string" } } }, required: ["code", "name"] } },
  { name: "logiless_bulk_create_articles", description: "Bulk create articles (max 100).", inputSchema: { type: "object", properties: { articles: { type: "array", items: { type: "object", properties: { code: { type: "string" }, name: { type: "string" } }, required: ["code", "name"] } } }, required: ["articles"] } },
  { name: "logiless_update_article", description: "Update an article.", inputSchema: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, price: { type: "number" } }, required: ["id"] } },
  { name: "logiless_delete_article", description: "Delete an article.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "logiless_list_sales_orders", description: "List sales orders with rich filtering.", inputSchema: { type: "object", properties: { limit: { type: "number" }, page: { type: "number" }, code: { type: "string" }, document_status: { type: "string" }, delivery_status: { type: "string" }, store: { type: "number" }, ordered_at_from: { type: "string" }, ordered_at_to: { type: "string" }, updated_at_from: { type: "string" }, updated_at_to: { type: "string" } } } },
  { name: "logiless_search_sales_orders", description: "Search sales orders by IDs or codes.", inputSchema: { type: "object", properties: { ids: { type: "array", items: { type: "number" } }, codes: { type: "array", items: { type: "string" } } } } },
  { name: "logiless_get_sales_order", description: "Get a single sales order by ID.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "logiless_create_sales_order", description: "Create a sales order.", inputSchema: { type: "object", properties: { code: { type: "string" }, buyer_name1: { type: "string" }, recipient_name1: { type: "string" }, recipient_address1: { type: "string" }, payment_method: { type: "string" }, delivery_method: { type: "string" }, store: { type: "number" }, lines: { type: "array", items: { type: "object", properties: { article_code: { type: "string" }, article_name: { type: "string" }, quantity: { type: "number" } }, required: ["article_code", "article_name", "quantity"] } } }, required: ["code", "buyer_name1", "recipient_name1", "recipient_address1", "payment_method", "delivery_method", "store", "lines"] } },
  { name: "logiless_update_sales_order", description: "Update a sales order.", inputSchema: { type: "object", properties: { id: { type: "string" }, tags: { type: "array", items: { type: "string" } } }, required: ["id"] } },
  { name: "logiless_cancel_sales_order", description: "Cancel a sales order.", inputSchema: { type: "object", properties: { id: { type: "string" }, clears_code: { type: "boolean" } }, required: ["id"] } },
  { name: "logiless_cancel_sales_order_line", description: "Cancel a single line item.", inputSchema: { type: "object", properties: { order_id: { type: "string" }, line_id: { type: "string" } }, required: ["order_id", "line_id"] } },
  { name: "logiless_list_outbound_deliveries", description: "List outbound (shipping) deliveries.", inputSchema: { type: "object", properties: { limit: { type: "number" }, page: { type: "number" }, warehouse: { type: "number" }, store: { type: "number" }, updated_at_from: { type: "string" }, updated_at_to: { type: "string" } } } },
  { name: "logiless_list_warehouses", description: "List warehouses.", inputSchema: { type: "object", properties: {} } },
  { name: "logiless_list_stores", description: "List stores.", inputSchema: { type: "object", properties: {} } },
  { name: "logiless_list_locations", description: "List locations.", inputSchema: { type: "object", properties: {} } },
  { name: "logiless_list_suppliers", description: "List suppliers.", inputSchema: { type: "object", properties: {} } },
  { name: "logiless_list_article_maps", description: "List article maps.", inputSchema: { type: "object", properties: {} } },
  { name: "logiless_list_reorder_points", description: "List reorder points.", inputSchema: { type: "object", properties: {} } },
  { name: "logiless_list_transaction_logs", description: "List transaction logs.", inputSchema: { type: "object", properties: {} } },
  { name: "logiless_list_inter_warehouse_transfers", description: "List inter-warehouse transfers.", inputSchema: { type: "object", properties: {} } },
  { name: "logiless_list_inbound_deliveries", description: "List inbound deliveries.", inputSchema: { type: "object", properties: {} } },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: ALL_TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result;
    switch (name) {
      case "logiless_list_actual_inventory":
        result = await client.listActualInventory({
          limit: args?.limit, page: args?.page,
          article_code: args?.article_code,
          warehouse_id: args?.warehouse_id,
          layer: args?.layer,
          updated_at_from: args?.updated_at_from, updated_at_to: args?.updated_at_to,
        }); break;
      case "logiless_search_actual_inventory":
        result = await client.searchActualInventory({
          article_codes: args?.article_codes,
          identification_codes: args?.identification_codes,
          model_numbers: args?.model_numbers,
          warehouse_id: args?.warehouse_id,
        }); break;
      case "logiless_list_logical_inventory":
        result = await client.listLogicalInventory({
          limit: args?.limit, page: args?.page,
          article_code: args?.article_code,
          warehouse_id: args?.warehouse_id,
          layer: args?.layer,
          is_reorder_level: args?.is_reorder_level,
          updated_at_from: args?.updated_at_from, updated_at_to: args?.updated_at_to,
        }); break;
      case "logiless_search_logical_inventory":
        result = await client.searchLogicalInventory({
          article_codes: args?.article_codes,
          identification_codes: args?.identification_codes,
          model_numbers: args?.model_numbers,
          warehouse_id: args?.warehouse_id,
        }); break;
      case "logiless_list_daily_inventory": result = await client.listDailyInventorySummaries(); break;
      case "logiless_list_articles":
        result = await client.listArticles({
          limit: args?.limit, page: args?.page, code: args?.code,
          article_type: args?.article_type, model_number: args?.model_number,
          updated_at_from: args?.updated_at_from, updated_at_to: args?.updated_at_to,
        }); break;
      case "logiless_get_article": result = await client.getArticle(String(args?.id)); break;
      case "logiless_create_article": result = await client.createArticle(args); break;
      case "logiless_bulk_create_articles": result = await client.bulkCreateArticles(args?.articles); break;
      case "logiless_update_article": result = await client.updateArticle(String(args?.id), args); break;
      case "logiless_delete_article": result = await client.deleteArticle(String(args?.id)); break;
      case "logiless_list_sales_orders":
        result = await client.listSalesOrders({
          limit: args?.limit, page: args?.page, code: args?.code,
          document_status: args?.document_status, delivery_status: args?.delivery_status,
          store: args?.store,
          ordered_at_from: args?.ordered_at_from, ordered_at_to: args?.ordered_at_to,
          updated_at_from: args?.updated_at_from, updated_at_to: args?.updated_at_to,
        }); break;
      case "logiless_search_sales_orders":
        result = await client.searchSalesOrders({ ids: args?.ids, codes: args?.codes }); break;
      case "logiless_get_sales_order": result = await client.getSalesOrder(String(args?.id)); break;
      case "logiless_create_sales_order": {
        const { lines, store, ...rest } = args;
        result = await client.createSalesOrder({ ...rest, store: Number(store), lines });
        break;
      }
      case "logiless_update_sales_order": {
        const { id, ...updates } = args;
        result = await client.updateSalesOrder(String(args?.id), updates); break;
      }
      case "logiless_cancel_sales_order":
        result = await client.cancelSalesOrder(String(args?.id), Boolean(args?.clears_code)); break;
      case "logiless_cancel_sales_order_line":
        result = await client.cancelSalesOrderLine(String(args?.order_id), String(args?.line_id)); break;
      case "logiless_list_outbound_deliveries":
        result = await client.listOutboundDeliveries({
          limit: args?.limit, page: args?.page,
          warehouse: args?.warehouse, store: args?.store,
          updated_at_from: args?.updated_at_from, updated_at_to: args?.updated_at_to,
        }); break;
      case "logiless_list_warehouses": result = await client.listWarehouses(); break;
      case "logiless_list_stores": result = await client.listStores(); break;
      case "logiless_list_locations": result = await client.listLocations(); break;
      case "logiless_list_suppliers": result = await client.listSuppliers(); break;
      case "logiless_list_article_maps": result = await client.listArticleMaps(); break;
      case "logiless_list_reorder_points": result = await client.listReorderPoints(); break;
      case "logiless_list_transaction_logs": result = await client.listTransactionLogs(); break;
      case "logiless_list_inter_warehouse_transfers": result = await client.listInterWarehouseTransfers(); break;
      case "logiless_list_inbound_deliveries": result = await client.listInboundDeliveries(); break;
      default: return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Logiless MCP server running on stdio");
}
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
