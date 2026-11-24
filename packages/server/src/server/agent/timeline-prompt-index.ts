import type { UserMessageSender } from "@getpaseo/protocol/agent-types";
import type { AgentTimelineRow } from "./agent-timeline-store-types.js";

const PROMPT_PREVIEW_MAX_LENGTH = 120;

export interface TimelinePromptIndexEntry {
  seq: number;
  timestamp: string;
  preview: string;
  sender?: UserMessageSender;
}

export interface TimelinePromptIndex {
  epoch: string;
  prompts: TimelinePromptIndexEntry[];
}

function promptPreview(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= PROMPT_PREVIEW_MAX_LENGTH) {
    return collapsed;
  }
  return `${collapsed.slice(0, PROMPT_PREVIEW_MAX_LENGTH - 1)}…`;
}

/**
 * One entry per prompt row. A prompt reaches an agent as a submitted user_message
 * (a person or a plugin) or as an agent_message tool_call (another agent through
 * send_agent_prompt); both can jump through the timeline, so both are indexed.
 */
export function buildTimelinePromptIndex(
  epoch: string,
  rows: readonly AgentTimelineRow[],
): TimelinePromptIndex {
  return {
    epoch,
    prompts: rows.flatMap((row) => {
      if (row.item.type === "user_message") {
        return [
          {
            seq: row.seq,
            timestamp: row.timestamp,
            preview: promptPreview(row.item.text),
            ...(row.item.sender ? { sender: row.item.sender } : {}),
          },
        ];
      }
      if (row.item.type === "tool_call" && row.item.agentMessage?.event === "message") {
        const { sender } = row.item.agentMessage;
        return [
          {
            seq: row.seq,
            timestamp: row.timestamp,
            preview: promptPreview(row.item.agentMessage.text),
            sender: {
              kind: "agent" as const,
              agentId: sender.id,
              ...(sender.serverId ? { serverId: sender.serverId } : {}),
              ...(sender.title ? { title: sender.title } : {}),
            },
          },
        ];
      }
      return [];
    }),
  };
}
