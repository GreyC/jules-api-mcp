# jules-mcp

An [MCP](https://modelcontextprotocol.io) server for [Jules](https://jules.google.com) — Google's AI coding agent. Manage Jules sessions from any MCP-compatible client: Claude, Gemini CLI, Cursor, Zed, VS Code, and more.

## Tools

| Tool | Description |
|------|-------------|
| `list_sessions` | List all Jules sessions |
| `get_session` | Get session details and current state |
| `create_session` | Create a new Jules session |
| `approve_plan` | Approve Jules's plan to proceed with execution |
| `send_message` | Send feedback or instructions to Jules |
| `list_activities` | Full activity timeline for a session |
| `get_last_message` | Jules's latest outbound message |
| `get_pr_url` | Get the PR URL from a completed session |

## Requirements

- Node.js 18+
- A Jules API key (`JULES_API_KEY`)

## Installation

### From source

```bash
git clone https://github.com/GreyC/jules-mcp
cd jules-mcp
npm install
npm run build
```

### Configuration

Add to your MCP client config (e.g. `~/.claude/claude_desktop_config.json` or `~/.gemini/settings.json`):

```json
{
  "mcpServers": {
    "jules": {
      "command": "node",
      "args": ["/path/to/jules-mcp/dist/index.js"],
      "env": {
        "JULES_API_KEY": "<your-key>"
      }
    }
  }
}
```

## Usage Examples

**List all sessions:**
```
list_sessions()
```

**Create a session with auto PR:**
```
create_session(
  repo="owner/repo",
  prompt="Refactor the login function in auth.py to use async/await",
  automation_mode="AUTO_CREATE_PR"
)
```

**Approve a plan:**
```
approve_plan(session_id="<ID>")
```

**Send feedback:**
```
send_message(session_id="<ID>", message="Looks good, please create the PR.")
```

## Session States

| State | Meaning |
|-------|---------|
| `IN_PROGRESS` | Jules is actively working |
| `AWAITING_PLAN_APPROVAL` | Jules generated a plan, waiting for approval |
| `AWAITING_USER_FEEDBACK` | Jules has a question mid-execution |
| `COMPLETED` | Jules finished |
| `FAILED` | Unrecoverable error |

## Related

- **[jules-skill](https://github.com/GreyC/jules-skill)** — Agent skill with workflow guidance, decision heuristics, and prompt templates for autonomous Jules management

## License

MIT
