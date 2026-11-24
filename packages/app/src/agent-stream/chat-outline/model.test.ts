import { describe, expect, it } from "vitest";
import {
  createActivePromptPublisher,
  shouldAcceptPromptIndexEpoch,
  promptTickMagnification,
  resolveActivePromptSeq,
  latestOwnPromptSeq,
  latestOtherPromptSeq,
  outlineSenderName,
  OUTLINE_MAGNIFY_RADIUS,
  type ChatOutlinePrompt,
} from "./model";

describe("chat outline prompt index epoch", () => {
  it("accepts only the authoritative timeline epoch", () => {
    expect(shouldAcceptPromptIndexEpoch("epoch-2", "epoch-2")).toBe(true);
    expect(shouldAcceptPromptIndexEpoch("epoch-2", "epoch-1")).toBe(false);
  });
});

function prompt(seq: number): ChatOutlinePrompt {
  return { seq, timestamp: new Date(seq).toISOString(), preview: `prompt ${seq}` };
}

describe("promptTickMagnification", () => {
  it("peaks under the pointer and decays to nothing at the radius", () => {
    expect(promptTickMagnification(0)).toBe(1);
    expect(promptTickMagnification(OUTLINE_MAGNIFY_RADIUS)).toBe(0);
    expect(promptTickMagnification(OUTLINE_MAGNIFY_RADIUS + 10)).toBe(0);
  });

  it("falls off monotonically and symmetrically around the pointer", () => {
    const above = [0, 1, 2, 3].map((distance) => promptTickMagnification(distance));
    const below = [0, -1, -2, -3].map((distance) => promptTickMagnification(distance));

    expect(above).toEqual(below);
    expect(above).toEqual([...above].sort((left, right) => right - left));
  });
});

describe("resolveActivePromptSeq", () => {
  const prompts = [prompt(2), prompt(9), prompt(20)];

  it("marks the prompt whose turn the reading position sits in", () => {
    expect(resolveActivePromptSeq(prompts, 9)).toBe(9);
    expect(resolveActivePromptSeq(prompts, 14)).toBe(9);
    expect(resolveActivePromptSeq(prompts, 20)).toBe(20);
    expect(resolveActivePromptSeq(prompts, 99)).toBe(20);
  });

  it("marks nothing above the first prompt or without a reading position", () => {
    expect(resolveActivePromptSeq(prompts, 1)).toBeNull();
    expect(resolveActivePromptSeq(prompts, null)).toBeNull();
    expect(resolveActivePromptSeq([], 42)).toBeNull();
  });
});

describe("latest prompt by sender", () => {
  const own = (seq: number): ChatOutlinePrompt => ({
    ...prompt(seq),
  });
  const other = (
    seq: number,
    sender: NonNullable<ChatOutlinePrompt["sender"]>,
  ): ChatOutlinePrompt => ({
    ...prompt(seq),
    sender,
  });

  it("finds the newest unattributed prompt as the reader's own", () => {
    const prompts = [
      other(2, { kind: "plugin", pluginId: "quince" }),
      own(5),
      other(8, { kind: "agent", agentId: "worker" }),
      own(11),
    ];
    expect(latestOwnPromptSeq(prompts)).toBe(11);
  });

  it("finds the newest attributed prompt as someone else's", () => {
    const prompts = [
      own(2),
      other(5, { kind: "agent", agentId: "worker", title: "Worker" }),
      own(8),
      other(11, { kind: "plugin", pluginId: "quince", label: "Quince" }),
    ];
    expect(latestOtherPromptSeq(prompts)).toBe(11);
  });

  it("returns null when a side has no prompt", () => {
    expect(latestOwnPromptSeq([other(2, { kind: "plugin", pluginId: "quince" })])).toBeNull();
    expect(latestOtherPromptSeq([own(2)])).toBeNull();
    expect(latestOwnPromptSeq([])).toBeNull();
    expect(latestOtherPromptSeq([])).toBeNull();
  });

  it("names senders from the most specific field", () => {
    expect(outlineSenderName({ kind: "plugin", pluginId: "quince", label: "Quince" })).toBe(
      "Quince",
    );
    expect(outlineSenderName({ kind: "plugin", pluginId: "quince" })).toBe("quince");
    expect(outlineSenderName({ kind: "agent", agentId: "a-1", title: "Worker" })).toBe("Worker");
    expect(outlineSenderName({ kind: "agent", agentId: "a-1" })).toBe("a-1");
  });
});

describe("createActivePromptPublisher", () => {
  it("notifies subscribers only when the active prompt changes", () => {
    const publisher = createActivePromptPublisher();
    let notifications = 0;
    const unsubscribe = publisher.subscribe(() => {
      notifications += 1;
    });

    publisher.publish(9);
    publisher.publish(9);
    publisher.publish(20);
    unsubscribe();
    publisher.publish(null);

    expect(notifications).toBe(2);
    expect(publisher.getActiveSeq()).toBeNull();
  });
});
