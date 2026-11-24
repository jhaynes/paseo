import { memo, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Pressable, Text, View, type PointerEvent as RNPointerEvent } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useReducedMotion } from "react-native-reanimated";
import { withUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { Bot, UserRound } from "lucide-react-native";
import { inlineUnistylesStyle } from "@/styles/unistyles-inline-style";
import { CHAT_OUTLINE_RAIL_LEFT, CHAT_OUTLINE_RAIL_WIDTH } from "./geometry";
import { createChatOutlineHoverIntent } from "./hover-intent";
import {
  latestOtherPromptSeq,
  latestOwnPromptSeq,
  outlineSenderName,
  promptTickMagnification,
} from "./model";
import type { ChatOutlineRailProps } from "./rail";

// Hover tracking lives on the rail and the slots, never on the Pressable inside them:
// magnifying a slot must not move the box the pointer is resting on. See docs/hover.md.
const RAIL_WIDTH = CHAT_OUTLINE_RAIL_WIDTH;
const RAIL_LEFT = CHAT_OUTLINE_RAIL_LEFT;
const SLOT_HEIGHT = 8;
const RESTING_PILL_HEIGHT = 2;
const MAGNIFIED_PILL_HEIGHT = 4;
const RESTING_PILL_WIDTH = 10;
const ACTIVE_PILL_WIDTH = 18;
const MAGNIFIED_PILL_WIDTH = 26;
const PREVIEW_WIDTH = 260;
const PREVIEW_HEIGHT = 48;
const PREVIEW_GAP = 4;

export const ChatOutlineRail = memo(function ChatOutlineRail({
  prompts,
  activePrompt,
  onJumpToPrompt,
}: ChatOutlineRailProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const activeSeq = useSyncExternalStore(activePrompt.subscribe, activePrompt.getActiveSeq);
  const prefersReducedMotion = useReducedMotion();
  const { t } = useTranslation();
  const ownSeq = useMemo(() => latestOwnPromptSeq(prompts), [prompts]);
  const otherSeq = useMemo(() => latestOtherPromptSeq(prompts), [prompts]);

  const hoverIntent = useMemo(
    () =>
      createChatOutlineHoverIntent({
        activate: setHoveredIndex,
        schedule: (callback, delayMs) => window.setTimeout(callback, delayMs),
        cancel: (timerId) => window.clearTimeout(timerId),
      }),
    [],
  );
  const handlePointerEnterTick = useCallback(
    (index: number) => hoverIntent.pointAt(index),
    [hoverIntent],
  );
  const handlePointerEnterRail = useCallback(
    (event: RNPointerEvent) => {
      hoverIntent.enter({ x: event.nativeEvent.clientX, y: event.nativeEvent.clientY });
    },
    [hoverIntent],
  );
  const handlePointerMoveRail = useCallback(
    (event: RNPointerEvent) => {
      hoverIntent.move({ x: event.nativeEvent.clientX, y: event.nativeEvent.clientY });
    },
    [hoverIntent],
  );
  const handlePointerLeaveRail = useCallback(() => hoverIntent.leave(), [hoverIntent]);
  useEffect(() => () => hoverIntent.dispose(), [hoverIntent]);
  const handleFocusChange = useCallback((index: number, focused: boolean) => {
    setFocusedIndex((current) => {
      if (focused) return index;
      return current === index ? null : current;
    });
  }, []);

  // The pointer owns the magnified band while it is on the rail; keyboard focus drives the
  // same band and the same preview once the pointer leaves.
  const attentionIndex = hoveredIndex ?? focusedIndex;

  return (
    <View
      style={styles.rail}
      role="tablist"
      testID="chat-outline-rail"
      onPointerEnter={handlePointerEnterRail}
      onPointerMove={handlePointerMoveRail}
      onPointerLeave={handlePointerLeaveRail}
    >
      <ChatOutlineQuickJump
        icon={UserRound}
        label={t("chatOutline.jumpToMyLatest")}
        seq={ownSeq}
        disabled={ownSeq === null}
        onJumpToPrompt={onJumpToPrompt}
      />
      <ChatOutlineQuickJump
        icon={Bot}
        label={t("chatOutline.jumpToLatestOther")}
        seq={otherSeq}
        disabled={otherSeq === null}
        onJumpToPrompt={onJumpToPrompt}
      />
      {prompts.map((prompt, index) => (
        <ChatOutlineTick
          key={prompt.seq}
          index={index}
          seq={prompt.seq}
          preview={prompt.preview}
          senderName={prompt.sender ? outlineSenderName(prompt.sender) : undefined}
          label={`${index + 1} of ${prompts.length}${prompt.sender ? ` (${outlineSenderName(prompt.sender)})` : ""}: ${prompt.preview}`}
          isActive={prompt.seq === activeSeq}
          hasAttention={index === attentionIndex}
          magnification={
            prefersReducedMotion || attentionIndex === null
              ? 0
              : promptTickMagnification(index - attentionIndex)
          }
          onHover={handlePointerEnterTick}
          onFocusChange={handleFocusChange}
          onJumpToPrompt={onJumpToPrompt}
        />
      ))}
    </View>
  );
});

interface ChatOutlineQuickJumpProps {
  icon: typeof UserRound;
  label: string;
  seq: number | null;
  disabled: boolean;
  onJumpToPrompt: (seq: number) => void;
}

function QuickJumpIconGlyph({ icon: Icon, color }: { icon: typeof UserRound; color: string }) {
  return <Icon size={12} color={color} />;
}

const ThemedQuickJumpIcon = withUnistyles(QuickJumpIconGlyph, (theme) => ({
  color: theme.colors.foregroundMuted,
}));

const ChatOutlineQuickJump = memo(function ChatOutlineQuickJump({
  icon,
  label,
  seq,
  disabled,
  onJumpToPrompt,
}: ChatOutlineQuickJumpProps) {
  const handlePress = useCallback(() => {
    if (seq !== null) onJumpToPrompt(seq);
  }, [onJumpToPrompt, seq]);
  return (
    <Pressable
      style={styles.quickJump}
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={`chat-outline-quick-jump-${seq === null ? "disabled" : seq}`}
    >
      <ThemedQuickJumpIcon icon={icon} />
    </Pressable>
  );
});

interface ChatOutlineTickProps {
  index: number;
  seq: number;
  preview: string;
  senderName?: string;
  label: string;
  isActive: boolean;
  hasAttention: boolean;
  magnification: number;
  onHover: (index: number) => void;
  onFocusChange: (index: number, focused: boolean) => void;
  onJumpToPrompt: (seq: number) => void;
}

const ChatOutlineTick = memo(function ChatOutlineTick({
  index,
  seq,
  preview,
  senderName,
  label,
  isActive,
  hasAttention,
  magnification,
  onHover,
  onFocusChange,
  onJumpToPrompt,
}: ChatOutlineTickProps) {
  const handlePress = useCallback(() => {
    onJumpToPrompt(seq);
    onFocusChange(index, false);
  }, [index, onFocusChange, onJumpToPrompt, seq]);
  const handlePointerEnter = useCallback(() => onHover(index), [index, onHover]);
  const handleFocus = useCallback(() => onFocusChange(index, true), [index, onFocusChange]);
  const handleBlur = useCallback(() => onFocusChange(index, false), [index, onFocusChange]);

  // The pill grows inside a slot that never moves, so magnification can never pull the hit
  // target out from under the pointer.
  const restingWidth = isActive ? ACTIVE_PILL_WIDTH : RESTING_PILL_WIDTH;
  const pillWidth = restingWidth + magnification * (MAGNIFIED_PILL_WIDTH - restingWidth);
  const pillHeight =
    RESTING_PILL_HEIGHT + magnification * (MAGNIFIED_PILL_HEIGHT - RESTING_PILL_HEIGHT);

  return (
    <View style={styles.slot} onPointerEnter={handlePointerEnter}>
      <Pressable
        style={styles.target}
        onPress={handlePress}
        onFocus={handleFocus}
        onBlur={handleBlur}
        accessibilityRole="tab"
        aria-selected={isActive}
        accessibilityLabel={label}
        testID={`chat-outline-tick-${seq}`}
      >
        <View
          style={[
            styles.pill,
            isActive && styles.pillActive,
            hasAttention && styles.pillAttention,
            inlineUnistylesStyle({ width: pillWidth, height: pillHeight }),
          ]}
        />
      </Pressable>
      {hasAttention ? (
        <View style={styles.preview} pointerEvents="none" aria-hidden testID="chat-outline-preview">
          {senderName ? (
            <Text style={styles.previewSender} numberOfLines={1}>
              {senderName}
            </Text>
          ) : null}
          <Text style={styles.previewText} numberOfLines={2}>
            {preview}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create((theme) => ({
  rail: {
    position: "absolute",
    left: RAIL_LEFT,
    top: "10%",
    bottom: "10%",
    width: RAIL_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  // Slots tile the rail with no gaps, so every pixel of the column belongs to a prompt even
  // when a long conversation squeezes them well below their resting height.
  slot: {
    width: RAIL_WIDTH,
    flexBasis: SLOT_HEIGHT,
    flexShrink: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // Pills share one left rail and grow rightward, so magnification reads as a bulge moving
  // with the pointer instead of every tick breathing about its own centre.
  target: {
    width: "100%",
    height: "100%",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingLeft: theme.spacing[1],
    borderRadius: theme.borderRadius.base,
  },
  // At rest the pills use low-emphasis chrome so the column stays readable peripherally
  // without competing with the transcript. Attention is the only foreground state.
  pill: {
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.borderAccent,
    transitionProperty: "width, height, background-color",
    transitionDuration: "140ms",
    transitionTimingFunction: "ease-out",
  },
  pillActive: {
    backgroundColor: theme.colors.foregroundExtraMuted,
  },
  pillAttention: {
    backgroundColor: theme.colors.foreground,
  },
  preview: {
    position: "absolute",
    left: RAIL_WIDTH + PREVIEW_GAP,
    top: "50%",
    marginTop: -PREVIEW_HEIGHT / 2,
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: theme.spacing[3],
    borderRadius: theme.borderRadius.lg,
    borderWidth: theme.borderWidth[1],
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
    ...theme.shadow.md,
  },
  previewText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
  },
  previewSender: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
    marginBottom: theme.spacing[1],
  },
  quickJump: {
    width: RAIL_WIDTH,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.base,
  },
}));
