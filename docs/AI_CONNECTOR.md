# SC Lab AI connector (MCP)

Lab members can connect their AI assistant (Claude, ChatGPT, GitHub Copilot, Cursor, Claude Code and any other
app that supports the Model Context Protocol) to SC Lab. The assistant then works on the member's behalf: it
reads and updates their work items, logs progress, completes milestones, raises leave, purchase and inventory
requests, books facilities and equipment, manages their daily to-dos and reads their notifications.

**Connector address:** `https://erp.sclab.in/mcp`

## How it stays safe

- Every member signs in with their own SC Lab account. The assistant acts as that member and nobody else.
- Every action goes through the same API and permission checks as the website, so the assistant can never do
  more than the member could do by hand.
- Self-service only: there are no tools to approve, reject, issue or return anything, even for admins.
- Decided records are left alone: the assistant can cancel only leave that is still pending and purchase
  requests that are still draft or submitted.
- Access ends immediately when the member clicks **Disconnect** under **AI Connector** in the SC Lab menu, changes their password, or
  is deactivated.
- Tokens are stored only as SHA-256 hashes. Sign-in tokens last 1 hour and refresh for up to 30 days of
  inactivity; access tokens last 90 days.

## For lab members: connecting your AI app

Use the sign-in method (OAuth) wherever your app supports it. You will see an SC Lab page asking for your email
and password. Press **Allow access** and you're done.

### Claude (claude.ai, desktop and mobile apps)
1. Open **Settings → Connectors → Add custom connector**.
2. Name: `SC Lab`. URL: `https://erp.sclab.in/mcp`. Click **Add**, then **Connect** and sign in.
3. In a chat, enable SC Lab from the tools menu and ask, for example, "What's due on my work this week?"

On a Claude Team or Enterprise plan, an owner adds the connector once under organisation settings. Each member
then just clicks **Connect**.

### ChatGPT
1. Open **Settings → Apps & Connectors → Advanced settings** and turn on **Developer mode**. Some plans need a
   workspace admin to allow this.
2. Choose **Create**, enter name `SC Lab`, URL `https://erp.sclab.in/mcp`, authentication **OAuth**, then sign in.

### Claude Code
```bash
claude mcp add --transport http sclab https://erp.sclab.in/mcp
```
Then run `/mcp` inside Claude Code and choose **Authenticate**.

### VS Code (GitHub Copilot agent mode)
Add to `.vscode/mcp.json` (or your user `mcp.json`):
```json
{ "servers": { "sclab": { "type": "http", "url": "https://erp.sclab.in/mcp" } } }
```
Start the server from the file and sign in when prompted.

### Cursor
Add to `~/.cursor/mcp.json`:
```json
{ "mcpServers": { "sclab": { "url": "https://erp.sclab.in/mcp" } } }
```

### Apps that cannot sign in: access token
Some tools, such as GitHub Copilot's cloud coding agent, need a fixed header instead of a sign-in.

1. In SC Lab, click **AI Connector** in the SC Lab menu and go to **Access token**. Name the token and click
   **Create token**.
2. Copy it now, because it is shown only once.
3. Configure the app to send `Authorization: Bearer <token>` to `https://erp.sclab.in/mcp`.

For the Copilot coding agent, add this in the repository's **Settings → Copilot → MCP configuration** and store
the token as the `COPILOT_MCP_SCLAB_TOKEN` secret:
```json
{
  "mcpServers": {
    "sclab": {
      "type": "http",
      "url": "https://erp.sclab.in/mcp",
      "headers": { "Authorization": "Bearer $COPILOT_MCP_SCLAB_TOKEN" },
      "tools": ["*"]
    }
  }
}
```

### Things to ask your assistant
- "Log 40% progress on my assay work: finished the pilot run, next step is the full plate."
- "Mark the 'Prep reagents' milestone complete and start today's to-do list with the remaining tasks."
- "Is the cell culture room free Thursday 10-12? If so, book it for passaging."
- "Raise a draft purchase request for two boxes of 200 µL tips for project CRTDH."
- "Apply for casual leave on 21-22 December for a family event."
- "What did admins comment on my work this week?"

## Tools

| Area | Tools |
| --- | --- |
| Overview | `whoami`, `get_dashboard` |
| Work | `list_my_work`, `get_work_item`, `create_work_item`, `update_work_item`, `log_progress`, `update_milestone`, `request_milestone_change`, `report_problem`, `update_problem`, `add_work_comment` |
| To-dos | `get_todos`, `add_todos`, `update_todo`, `delete_todo`, `carry_forward_todos` |
| Leave | `list_my_leave_requests`, `apply_for_leave`, `cancel_leave_request` |
| Purchases | `list_my_purchase_requests`, `create_purchase_request`, `submit_purchase_request`, `cancel_purchase_request` |
| Inventory | `search_inventory`, `list_my_inventory_requests`, `request_inventory_item` |
| Bookings | `list_facilities`, `get_bookings`, `book_facility`, `book_equipment`, `cancel_booking` |
| Projects | `list_projects`, `add_project_achievement` (project team members only) |
| Notifications | `list_notifications`, `mark_notifications_read` |

Read tools are marked read-only and write tools are marked as writes. Delete and cancel tools are marked
destructive, so AI apps that ask before acting will ask before these.

## For the administrator: deployment

The connector is part of the main server (`server/src/mcp/`). It needs no extra service.

- **Public address.** The connector is served at `<public https origin>/mcp`. The origin comes from
  `MCP_PUBLIC_URL`, or from `APP_URL` when that starts with `https://` (production already sets
  `APP_URL=https://erp.sclab.in`). If neither is https and the host is not localhost, the connector stays
  disabled and the server logs a warning. AI apps like claude.ai and ChatGPT connect from the internet, so
  this address must be publicly reachable over https.
- **Reverse proxy.** Forward these paths to the Node server in addition to `/api`:
  - `/mcp`, `/authorize`, `/token`, `/register`, `/revoke`, `/oauth/login`
  - `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource/mcp`
  
  If the proxy already sends everything to Node, nothing changes. Keep `trust proxy` at one hop, so that
  sign-in rate limits see real client IPs.
- **Database.** The tables `mcp_oauth_clients`, `mcp_auth_codes`, `mcp_grants` and `mcp_tokens` are created
  automatically at startup by `ensureMcpSchema()`. Expired codes and tokens are removed on each boot.
- **Rate limits.** `/mcp` allows 120 requests per minute per IP. Wrong passwords on the connector sign-in page
  count toward the same lockout as the website login.
- **How tools call the API.** Each tool calls the local API at `http://127.0.0.1:$PORT` with a session token
  minted for that one call. To use a different internal address, set `MCP_INTERNAL_API_URL`.
- **Revoking everyone.** Run `UPDATE mcp_grants SET revoked_at = now() WHERE revoked_at IS NULL;` then
  `DELETE FROM mcp_tokens;`.
