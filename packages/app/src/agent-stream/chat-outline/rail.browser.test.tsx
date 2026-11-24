import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { within } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n as testI18n } from "@/i18n/i18next";
import type { ActivePromptSource, ChatOutlinePrompt } from "./model";
import { ChatOutlineRail } from "./rail";

// Load translations so the quick jumps expose their real accessible names.
void testI18n;

// App sources compile against the classic JSX runtime, which expects React on the global.
beforeEach(() => vi.stubGlobal("React", React));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const view = () => within(container);

const activePrompt: ActivePromptSource = {
  subscribe: () => () => {},
  getActiveSeq: () => null,
};

function prompt(seq: number, sender?: ChatOutlinePrompt["sender"]): ChatOutlinePrompt {
  return {
    seq,
    timestamp: new Date(seq).toISOString(),
    preview: `prompt ${seq}`,
    ...(sender ? { sender } : {}),
  };
}

function renderRail(prompts: ChatOutlinePrompt[], onJumpToPrompt: (seq: number) => void) {
  act(() => {
    root.render(
      <ChatOutlineRail
        prompts={prompts}
        activePrompt={activePrompt}
        onJumpToPrompt={onJumpToPrompt}
      />,
    );
  });
}

describe("chat outline rail quick jumps", () => {
  it("jumps to the reader's latest own prompt and to the latest prompt from someone else", async () => {
    const onJumpToPrompt = vi.fn();
    renderRail(
      [
        prompt(2, { kind: "plugin", pluginId: "quince", label: "Quince" }),
        prompt(5),
        prompt(9, { kind: "agent", agentId: "worker", title: "Worker" }),
        prompt(12),
      ],
      onJumpToPrompt,
    );

    await act(async () => {
      await view().getByRole("button", { name: "Jump to my latest prompt" }).click();
    });
    expect(onJumpToPrompt).toHaveBeenLastCalledWith(12);

    await act(async () => {
      await view().getByRole("button", { name: "Jump to latest prompt from someone else" }).click();
    });
    expect(onJumpToPrompt).toHaveBeenLastCalledWith(9);
  });

  it("disables a quick jump whose side has no prompt", async () => {
    const onJumpToPrompt = vi.fn();
    renderRail([prompt(3)], onJumpToPrompt);

    const own = view().getByRole("button", { name: "Jump to my latest prompt" });
    const other = view().getByRole("button", { name: "Jump to latest prompt from someone else" });
    expect(own.hasAttribute("disabled")).toBe(false);
    expect(other.hasAttribute("disabled")).toBe(true);

    await act(async () => {
      await other.click();
    });
    expect(onJumpToPrompt).not.toHaveBeenCalled();
  });

  it("shows the sender on an attributed entry's preview", async () => {
    const onJumpToPrompt = vi.fn();
    renderRail(
      [prompt(2), prompt(6, { kind: "plugin", pluginId: "quince", label: "Quince" })],
      onJumpToPrompt,
    );

    // Keyboard focus drives the same preview the pointer does.
    await act(async () => {
      view().getByTestId("chat-outline-tick-6").focus();
    });
    expect(view().getByText("Quince")).toBeTruthy();
  });
});
