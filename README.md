# LOGILESS MCP Server

MCP server for [LOGILESS](https://www.logiless.com/) (ロジレス) — Japan's leading OMS/WMS integration platform for e-commerce.

Exposes inventory, sales orders, outbound deliveries, articles, and master data via the Model Context Protocol.

## Prerequisites

- Node.js 18+
- A LOGILESS account with API access (審査完了済み)
- Access token and merchant ID

## Installation

### Option 1: npx (recommended)

```bash
npx -y logiless-mcp
```

### Option 2: Local install

```bash
git clone https://github.com/yasuhidekoizumi-afk/logiless-mcp.git
cd logiless-mcp
npm install
npm run build
```

## Configuration

Set these environment variables:

```bash
LOGILESS_ACCESS_TOKEN=your_access_token_here
LOGILESS_MERCHANT_ID=your_merchant_id_here
```

### Hermes Agent config.yaml

```yaml
mcp_servers:
  logiless:
    command: npx
    args: ["-y", "logiless-mcp"]
    env:
      LOGILESS_ACCESS_TOKEN: "your_token"
      LOGILESS_MERCHANT_ID: "your_merchant_id"
```

## Available Tools

### Inventory
- `logiless_list_actual_inventory` — List actual inventory
- `logiless_search_actual_inventory` — Search actual inventory by codes
- `logiless_list_logical_inventory` — List logical inventory
- `logiless_search_logical_inventory` — Search logical inventory by codes
- `logiless_list_daily_inventory` — List daily inventory summaries

### Articles
- `logiless_list_articles` — List with filters
- `logiless_get_article` — Get details
- `logiless_create_article` — Create
- `logiless_bulk_create_articles` — Bulk create (max 100)
- `logiless_update_article` — Update
- `logiless_delete_article` — Delete

### Sales Orders
- `logiless_list_sales_orders` — List with filters
- `logiless_search_sales_orders` — Search by IDs or codes
- `logiless_get_sales_order` — Get details
- `logiless_create_sales_order` — Create
- `logiless_update_sales_order` — Update
- `logiless_cancel_sales_order` — Cancel
- `logiless_cancel_sales_order_line` — Cancel a line item

### Outbound Deliveries (Read-only)
- `logiless_list_outbound_deliveries` — List outbound deliveries

### Master Data
- `logiless_list_warehouses`, `logiless_list_stores`, `logiless_list_locations`
- `logiless_list_suppliers`, `logiless_list_article_maps`
- `logiless_list_reorder_points`, `logiless_list_transaction_logs`
- `logiless_list_inter_warehouse_transfers`, `logiless_list_inbound_deliveries`
- `logiless_list_daily_inventory`

## API Reference

- **Base**: `https://app2.logiless.com/api/`
- **Endpoint prefix**: `/api/v1/merchant/{merchant_id}/{resource}`
- **Pagination**: `limit` (default 20, max 100) + `page` (default 1)
- **Auth**: OAuth2 Bearer token

## License

MIT