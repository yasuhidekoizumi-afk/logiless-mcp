# LOGILESS MCP Server

[![npm version](https://img.shields.io/npm/v/logiless-mcp)](https://www.npmjs.com/package/logiless-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP (Model Context Protocol) server for **[LOGILESS](https://www.logiless.com/) (ロジレス)** — Japan's leading OMS/WMS integration platform for e-commerce.

Exposes LOGILESS inventory, sales orders, outbound deliveries, articles, and master data as MCP tools. Works with any MCP client: Claude Code, Hermes Agent, Cursor, VS Code Copilot, and more.

## Features

- **28 tools** covering all major LOGILESS API resources
- **Dual mode**: stdio (Hermes/Claude) + HTTP (Claude Code / remote clients)
- **Full CRUD** for articles and sales orders
- **Rich filtering** — status, date range, store, warehouse, article code
- **Bulk operations** — create up to 100 articles at once
- **Search by codes** — batch-query inventory and orders
- **Read-only safety** — outbound deliveries are auto-generated; lifecycle management is audit-safe

## Tools

### Inventory (5)
| Tool | Description |
|---|---|
| `logiless_list_actual_inventory` | Physical inventory by warehouse/location |
| `logiless_search_actual_inventory` | Search by article codes (max 100) |
| `logiless_list_logical_inventory` | Logical inventory (ordered/available/free) |
| `logiless_search_logical_inventory` | Search by codes (max 100) |
| `logiless_list_daily_inventory` | Daily inventory snapshots |

### Articles (6)
| Tool | Description |
|---|---|
| `logiless_list_articles` | List with filters (type/code/date) |
| `logiless_get_article` | Get by ID |
| `logiless_create_article` | Create new |
| `logiless_bulk_create_articles` | Bulk create (max 100) |
| `logiless_update_article` | Update |
| `logiless_delete_article` | Delete ⚠️ |

### Sales Orders (7)
| Tool | Description |
|---|---|
| `logiless_list_sales_orders` | List with rich filters |
| `logiless_search_sales_orders` | Search by IDs/codes |
| `logiless_get_sales_order` | Get by ID |
| `logiless_create_sales_order` | Create |
| `logiless_update_sales_order` | Update |
| `logiless_cancel_sales_order` | Cancel |
| `logiless_cancel_sales_order_line` | Cancel single line item |

### Outbound Deliveries (1 — read-only)
| Tool | Description |
|---|---|
| `logiless_list_outbound_deliveries` | List shipping deliveries |

### Master Data (9)
| Tool | Description |
|---|---|
| `logiless_list_warehouses` | Warehouses |
| `logiless_list_stores` | Stores/channels |
| `logiless_list_locations` | Warehouse locations (requires `warehouse_id`) |
| `logiless_list_suppliers` | Suppliers |
| `logiless_list_article_maps` | Store-to-article mappings |
| `logiless_list_reorder_points` | Reorder point config |
| `logiless_list_transaction_logs` | Transaction audit logs |
| `logiless_list_inter_warehouse_transfers` | Inter-warehouse transfers |
| `logiless_list_inbound_deliveries` | Inbound deliveries |

## Prerequisites

- **Node.js 18+**
- A **LOGILESS account** with API access (申請・審査完了済み)
- **Access token** and **merchant ID**

## Quick Start

### 1. Get API credentials from LOGILESS

LOGILESS uses OAuth2. Obtain tokens from the developer console:

1. Go to [LOGILESS Developer Console](https://app2.logiless.com/developer/console/clients)
2. Register an application (審査需3-5営業日)
3. Complete the OAuth2 authorization code flow to get an access token
4. Get your merchant ID from the dashboard URL: `https://app2.logiless.com/merchant/{ID}/dashboard`

### 2. Run the server

```bash
# Set credentials
export LOGILESS_ACCESS_TOKEN="your_access_token"
export LOGILESS_MERCHANT_ID="your_merchant_id"

# Run (stdio mode; outputs JSON-RPC on stdin/stdout)
npx -y logiless-mcp
```

## Configuration

### Hermes Agent

```yaml
# ~/.hermes/config.yaml
mcp_servers:
  logiless:
    command: npx
    args: ["-y", "logiless-mcp"]
    env:
      LOGILESS_ACCESS_TOKEN: "your_token"
      LOGILESS_MERCHANT_ID: "your_merchant_id"
```

### Claude Code (HTTP mode)

Run the HTTP server on your infrastructure:

```bash
export LOGILESS_ACCESS_TOKEN="your_token"
export LOGILESS_MERCHANT_ID="2502"
export LOGILESS_MCP_API_KEY="generate-a-random-key"
node /path/to/logiless-mcp/http-server.mjs
```

Then configure Claude Code:

```json
// ~/.claude/settings.json or project .claude/settings.json
{
  "mcpServers": {
    "logiless": {
      "url": "https://your-server.com/mcp/logiless/mcp",
      "headers": {
        "X-API-Key": "your-api-key"
      }
    }
  }
}
```

### VS Code / Cursor / Any MCP client

```json
{
  "mcpServers": {
    "logiless": {
      "command": "npx",
      "args": ["-y", "logiless-mcp"],
      "env": {
        "LOGILESS_ACCESS_TOKEN": "your_token",
        "LOGILESS_MERCHANT_ID": "your_merchant_id"
      }
    }
  }
}
```

## HTTP Mode (Team Deployment)

For teams, deploy the HTTP server on a VPS for shared access. All team members share the same API key — no need to distribute LOGILESS credentials.

### Systemd Service

```bash
# Clone and build
git clone https://github.com/yasuhidekoizumi-afk/logiless-mcp.git /opt/logiless-mcp
cd /opt/logiless-mcp && npm install && npm run build

# Environment file
cat > /opt/logiless-mcp/.env << 'EOF'
LOGILESS_ACCESS_TOKEN=your_access_token
LOGILESS_MERCHANT_ID=your_merchant_id
LOGILESS_MCP_API_KEY=your_shared_api_key
EOF

# Systemd service
cat > /etc/systemd/system/logiless-mcp.service << 'SERVICEEOF'
[Unit]
Description=Logiless HTTP MCP Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/logiless-mcp
EnvironmentFile=/opt/logiless-mcp/.env
ExecStart=/usr/bin/node /opt/logiless-mcp/http-server.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload && systemctl enable --now logiless-mcp
```

### Caddy Reverse Proxy

```caddy
# /etc/caddy/Caddyfile or your server block
handle_path /mcp/logiless/* {
    reverse_proxy 127.0.0.1:3938
}
```

## API Reference

| Item | Value |
|---|---|
| **Base URL** | `https://app2.logiless.com/api/` |
| **Endpoint prefix** | `/api/v1/merchant/{merchant_id}/{resource}` |
| **Auth** | Bearer token (`Authorization: Bearer {token}` + `X-Merchant-Id` header) |
| **Pagination** | `limit` (default 20, max 100) + `page` (default 1) |
| **Rate limit** | 1500 req/min (check `X-RateLimit-Remaining` header) |

### Common Pitfalls

1. **Access tokens expire in 30 days.** Use the OAuth2 refresh token flow to renew.
2. **Locations endpoint** requires `warehouse_id`: `GET /warehouses/{id}/locations`
3. **Daily inventory** requires `date` parameter (`Y-m-d` format)
4. **Outbound deliveries are read-only** — they auto-generate from sales orders
5. **Article code filters are single-value** — use the `search` endpoints for batch lookups (max 100)
6. **Zero-quantity inventory** requires `updated_at_from` to appear in results
7. **HTTP 423** means the document status is locked — cancel and recreate instead

## Authentication

LOGILESS uses OAuth2 authorization code flow:

```
1. Register app           → https://app2.logiless.com/developer/console/clients
2. Get authorization code → GET https://app2.logiless.com/oauth/v2/auth?client_id=...&response_type=code&redirect_uri=...
3. Exchange for tokens    → GET https://app2.logiless.com/oauth2/token?client_id=...&client_secret=...&code=...&grant_type=authorization_code
4. Response               → { access_token, refresh_token, expires_in: 2592000 }
5. Use header             → Authorization: Bearer {access_token}
```

The auth code expires in **30 seconds** — exchange it immediately.

## Project Structure

```
logiless-mcp/
├── src/
│   ├── index.ts        # MCP server entry (stdio)
│   ├── client.ts       # LOGILESS API client
│   └── types.ts        # TypeScript types
├── http-server.mjs     # HTTP MCP server (for team deployment)
├── dist/               # Built output
├── .env.example        # Environment template
└── package.json
```

## Development

```bash
git clone https://github.com/yasuhidekoizumi-afk/logiless-mcp.git
cd logiless-mcp
npm install
npm run build   # builds dist/
```

## License

MIT

## Author

Yasuhide Koizumi — ORYZAE Inc.
