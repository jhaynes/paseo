import { describe, expect, test } from "vitest";
import {
  AgentTimelineItemPayloadSchema,
  AgentTimelineListPromptsResponseMessageSchema,
} from "./messages.js";

describe("user_message sender", () => {
  test("parses agent and plugin senders and keeps absent sender valid", () => {
    expect(
      AgentTimelineItemPayloadSchema.safeParse({
        type: "user_message",
        text: "hello",
      }).success,
    ).toBe(true);
    expect(
      AgentTimelineItemPayloadSchema.parse({
        type: "user_message",
        text: "hello",
        sender: { kind: "agent", agentId: "worker", title: "Worker" },
      }).sender,
    ).toEqual({ kind: "agent", agentId: "worker", title: "Worker" });
    expect(
      AgentTimelineItemPayloadSchema.parse({
        type: "user_message",
        text: "hello",
        sender: { kind: "plugin", pluginId: "quince", label: "Quince" },
      }).sender,
    ).toEqual({ kind: "plugin", pluginId: "quince", label: "Quince" });
    expect(
      AgentTimelineItemPayloadSchema.safeParse({
        type: "user_message",
        text: "hello",
        sender: { kind: "machine" },
      }).success,
    ).toBe(false);
  });

  test("carries the sender through the prompt index response", () => {
    const message = {
      type: "agent.timeline.list_prompts.response",
      payload: {
        requestId: "req-1",
        agentId: "agent-1",
        epoch: "epoch-1",
        prompts: [
          { seq: 1, timestamp: "2026-01-01T00:00:00.000Z", preview: "mine" },
          {
            seq: 4,
            timestamp: "2026-01-01T00:00:01.000Z",
            preview: "theirs",
            sender: { kind: "plugin", pluginId: "quince" },
          },
        ],
        error: null,
      },
    };
    expect(AgentTimelineListPromptsResponseMessageSchema.parse(message)).toEqual(message);
    expect(
      AgentTimelineListPromptsResponseMessageSchema.safeParse({
        ...message,
        payload: {
          ...message.payload,
          prompts: [{ ...message.payload.prompts[0], sender: { kind: "unknown" } }],
        },
      }).success,
    ).toBe(false);
  });
});
