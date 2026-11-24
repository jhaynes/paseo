import { describe, expect, it } from "vitest";
import type { AgentTimelineRow } from "./agent-timeline-store-types.js";
import { buildTimelinePromptIndex } from "./timeline-prompt-index.js";

describe("buildTimelinePromptIndex", () => {
  it("indexes every canonical user prompt with a stable timeline position", () => {
    const rows: AgentTimelineRow[] = [
      {
        seq: 3,
        timestamp: "2026-01-01T00:00:00.000Z",
        item: { type: "user_message", text: "  First\n\n   prompt  " },
      },
      {
        seq: 4,
        timestamp: "2026-01-01T00:00:01.000Z",
        item: { type: "assistant_message", text: "response" },
      },
      {
        seq: 8,
        timestamp: "2026-01-01T00:00:02.000Z",
        item: { type: "user_message", text: "Second prompt" },
      },
    ];

    expect(buildTimelinePromptIndex("epoch-1", rows)).toEqual({
      epoch: "epoch-1",
      prompts: [
        { seq: 3, timestamp: "2026-01-01T00:00:00.000Z", preview: "First prompt" },
        { seq: 8, timestamp: "2026-01-01T00:00:02.000Z", preview: "Second prompt" },
      ],
    });
  });

  it("bounds previews without indexing assistant rows", () => {
    const rows: AgentTimelineRow[] = [
      {
        seq: 1,
        timestamp: "2026-01-01T00:00:00.000Z",
        item: { type: "user_message", text: "x".repeat(200) },
      },
      {
        seq: 2,
        timestamp: "2026-01-01T00:00:01.000Z",
        item: { type: "assistant_message", text: "ignored" },
      },
    ];

    const result = buildTimelinePromptIndex("epoch-1", rows);

    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]?.preview).toHaveLength(120);
    expect(result.prompts[0]?.preview.endsWith("…")).toBe(true);
  });

  it("keeps the recorded sender on a prompt entry", () => {
    const rows: AgentTimelineRow[] = [
      {
        seq: 1,
        timestamp: "2026-01-01T00:00:00.000Z",
        item: { type: "user_message", text: "mine" },
      },
      {
        seq: 2,
        timestamp: "2026-01-01T00:00:01.000Z",
        item: {
          type: "user_message",
          text: "theirs",
          sender: { kind: "plugin", pluginId: "quince", label: "Quince" },
        },
      },
    ];

    expect(buildTimelinePromptIndex("epoch-1", rows).prompts).toEqual([
      { seq: 1, timestamp: "2026-01-01T00:00:00.000Z", preview: "mine" },
      {
        seq: 2,
        timestamp: "2026-01-01T00:00:01.000Z",
        preview: "theirs",
        sender: { kind: "plugin", pluginId: "quince", label: "Quince" },
      },
    ]);
  });

  it("indexes agent message rows as prompts with their agent sender", () => {
    const rows: AgentTimelineRow[] = [
      {
        seq: 1,
        timestamp: "2026-01-01T00:00:00.000Z",
        item: { type: "user_message", text: "mine" },
      },
      {
        seq: 2,
        timestamp: "2026-01-01T00:00:01.000Z",
        item: {
          type: "tool_call",
          callId: "paseo-agent-message:m-1",
          name: "agent_message",
          status: "completed",
          error: null,
          agentMessage: {
            event: "message",
            sender: { id: "orchestrator", serverId: "host-2", title: "Orchestrator" },
            text: "  Run the  checks  ",
          },
          detail: { type: "plain_text", text: "Run the checks", icon: "bot" },
        },
      },
      {
        // Completion notifications are not prompts.
        seq: 3,
        timestamp: "2026-01-01T00:00:02.000Z",
        item: {
          type: "tool_call",
          callId: "paseo-agent-message:m-2",
          name: "agent_message",
          status: "completed",
          error: null,
          agentMessage: {
            event: "finished",
            sender: { id: "orchestrator" },
            text: "Worker finished",
          },
          detail: { type: "plain_text", text: "Worker finished", icon: "bot" },
        },
      },
    ];

    expect(buildTimelinePromptIndex("epoch-1", rows).prompts).toEqual([
      { seq: 1, timestamp: "2026-01-01T00:00:00.000Z", preview: "mine" },
      {
        seq: 2,
        timestamp: "2026-01-01T00:00:01.000Z",
        preview: "Run the checks",
        sender: {
          kind: "agent",
          agentId: "orchestrator",
          serverId: "host-2",
          title: "Orchestrator",
        },
      },
    ]);
  });
});
