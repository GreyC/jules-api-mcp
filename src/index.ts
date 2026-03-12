#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = "https://jules.googleapis.com/v1alpha";

function getApiKey(): string {
  const key = process.env.JULES_API_KEY;
  if (!key) throw new Error("JULES_API_KEY environment variable is not set");
  return key;
}

function headers() {
  return {
    "x-goog-api-key": getApiKey(),
    "Content-Type": "application/json",
  };
}

async function fetchAll<T>(
  url: string,
  itemsKey: string
): Promise<T[]> {
  const all: T[] = [];
  let pageToken: string | undefined;
  do {
    const params = pageToken ? `?pageToken=${pageToken}` : "";
    const res = await fetch(`${url}${params}`, { headers: headers() });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    all.push(...(data[itemsKey] ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return all;
}

const server = new McpServer({
  name: "jules-mcp",
  version: "1.0.0",
});

// list_sessions
server.registerTool(
  "list_sessions",
  {
    description: "List all Jules sessions with pagination",
    inputSchema: {},
  },
  async () => {
    const sessions = await fetchAll(`${BASE_URL}/sessions`, "sessions");
    return { content: [{ type: "text", text: JSON.stringify(sessions, null, 2) }] };
  }
);

// get_session
server.registerTool(
  "get_session",
  {
    description: "Get details and current state of a Jules session",
    inputSchema: {
      session_id: z.string().describe("Jules session ID"),
    },
  },
  async ({ session_id }) => {
    const res = await fetch(`${BASE_URL}/sessions/${session_id}`, { headers: headers() });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// create_session
server.registerTool(
  "create_session",
  {
    description: "Create a new Jules session to work on a GitHub repository",
    inputSchema: {
      repo: z.string().describe("GitHub repository in owner/repo format"),
      prompt: z.string().describe("Task description for Jules"),
      automation_mode: z
        .enum(["AUTO_CREATE_PR", "NONE"])
        .optional()
        .describe("AUTO_CREATE_PR to have Jules open a PR automatically"),
      require_plan_approval: z
        .boolean()
        .optional()
        .describe("Pause for plan review before Jules executes"),
    },
  },
  async ({ repo, prompt, automation_mode, require_plan_approval }) => {
    const title = prompt.length > 50 ? prompt.slice(0, 50) + "..." : prompt;
    const payload: Record<string, unknown> = {
      title,
      prompt,
      sourceContext: {
        source: `sources/github/${repo}`,
        githubRepoContext: { startingBranch: "main" },
      },
      requirePlanApproval: require_plan_approval ?? false,
    };
    if (automation_mode) payload.automationMode = automation_mode;

    const res = await fetch(`${BASE_URL}/sessions`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// approve_plan
server.registerTool(
  "approve_plan",
  {
    description: "Approve Jules's plan so it proceeds with execution (use when state is AWAITING_PLAN_APPROVAL)",
    inputSchema: {
      session_id: z.string().describe("Jules session ID"),
    },
  },
  async ({ session_id }) => {
    const res = await fetch(`${BASE_URL}/sessions/${session_id}:approvePlan`, {
      method: "POST",
      headers: headers(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// send_message
server.registerTool(
  "send_message",
  {
    description: "Send a message or feedback to a Jules session",
    inputSchema: {
      session_id: z.string().describe("Jules session ID"),
      message: z.string().describe("Message or instructions to send"),
    },
  },
  async ({ session_id, message }) => {
    const res = await fetch(`${BASE_URL}/sessions/${session_id}:sendMessage`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ prompt: message }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// list_activities
server.registerTool(
  "list_activities",
  {
    description: "List the full activity timeline for a Jules session",
    inputSchema: {
      session_id: z.string().describe("Jules session ID"),
    },
  },
  async ({ session_id }) => {
    const activities = await fetchAll(
      `${BASE_URL}/sessions/${session_id}/activities`,
      "activities"
    );
    return { content: [{ type: "text", text: JSON.stringify(activities, null, 2) }] };
  }
);

// get_last_message
server.registerTool(
  "get_last_message",
  {
    description: "Get the last message Jules sent in a session",
    inputSchema: {
      session_id: z.string().describe("Jules session ID"),
    },
  },
  async ({ session_id }) => {
    const activities = await fetchAll<Record<string, unknown>>(
      `${BASE_URL}/sessions/${session_id}/activities`,
      "activities"
    );
    const messages: string[] = [];
    for (const a of activities) {
      if ("agentMessaged" in a) {
        const msg = (a.agentMessaged as Record<string, unknown>).agentMessage;
        messages.push(
          typeof msg === "object" && msg !== null
            ? ((msg as Record<string, unknown>).text as string) ?? JSON.stringify(msg)
            : String(msg)
        );
      }
    }
    const last = messages.at(-1) ?? "No agent messages found.";
    return { content: [{ type: "text", text: last }] };
  }
);

// get_pr_url
server.registerTool(
  "get_pr_url",
  {
    description: "Get the pull request URL created by a completed Jules session",
    inputSchema: {
      session_id: z.string().describe("Jules session ID"),
    },
  },
  async ({ session_id }) => {
    const res = await fetch(`${BASE_URL}/sessions/${session_id}`, { headers: headers() });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const session = await res.json();
    for (const output of session.outputs ?? []) {
      const pr = output.pullRequest ?? {};
      const url = pr.url ?? pr.pullRequestUrl;
      if (url) return { content: [{ type: "text", text: url }] };
    }
    return { content: [{ type: "text", text: "No PR URL found in session outputs." }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
