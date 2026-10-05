// ─── Brain Bubbles ─────────────────────────────────────────────────────────────
//
// Infinite draggable canvas with pinch-to-zoom.
// Each bubble is a draggable card with a title + freeform text.
//
// Tap a bubble → open write view (fullscreen text editor)
// Long-press a bubble → delete prompt
// Tap "+" → create new bubble (title + color picker sheet)
// Pinch canvas → zoom in/out
// Drag empty space → pan the canvas

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  Modal, Alert, Animated,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  PinchGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PinchGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import { useBubblesStore, BUBBLE_COLORS, type Bubble, type BubbleColor } from '@/stores/useBubblesStore';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';

// ─── Write view — fullscreen text editor for a single bubble ─────────────────

function WriteView({ bubble, onClose }: { bubble: Bubble; onClose: () => void }) {
  const { colors } = useTheme();
  const { updateBubble, deleteBubble } = useBubblesStore();
  const [text, setText] = useState(bubble.text);
  const [title, setTitle] = useState(bubble.title);

  // Android back / swipe leaves this screen without pressing the arrow, which used to
  // drop the edit. Keep the latest text in a ref and save it whenever the view goes away.
  const latest = useRef({ text, title });
  latest.current = { text, title };
  const deleted = useRef(false);
  useEffect(() => () => {
    if (!deleted.current) updateBubble(bubble.id, latest.current);
  }, [bubble.id]);

  const save = useCallback(() => {
    updateBubble(bubble.id, { text, title });
    onClose();
  }, [text, title, bubble.id]);

  const confirmDelete = () => {
    Alert.alert('Delete bubble?', `"${bubble.title}" will be gone forever.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => { deleted.current = true; deleteBubble(bubble.id); onClose(); },
      },
    ]);
  };

  return (
    <View style={[writeStyles.bg, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* header */}
        <View style={writeStyles.header}>
          <Pressable onPress={save} hitSlop={12} style={writeStyles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.textSecondary} />
          </Pressable>
          <TextInput
            style={[writeStyles.titleInput, { color: colors.text, borderBottomColor: colors.cardBorder }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Bubble title"
            placeholderTextColor={colors.textMuted}
          />
          <Pressable onPress={confirmDelete} hitSlop={12}>
            <Feather name="trash-2" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* colour strip */}
        <View style={[writeStyles.colorStrip, { borderBottomColor: colors.border }]}>
          {BUBBLE_COLORS.map((c) => (
            <Pressable
              key={c}
              style={[writeStyles.colorDot, { backgroundColor: c, borderWidth: c === bubble.color ? 2.5 : 0, borderColor: colors.text }]}
              onPress={() => updateBubble(bubble.id, { color: c as BubbleColor })}
            />
          ))}
        </View>

        {/* text area */}
        <TextInput
          style={[writeStyles.textArea, { color: colors.text }]}
          value={text}
          onChangeText={setText}
          placeholder="Let it out…"
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
        />
      </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const writeStyles = StyleSheet.create({
  bg:   { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backBtn: { padding: SPACING.xs },
  titleInput: {
    flex: 1,
    fontFamily: FONTS.bodyBold,
    fontSize: 18,
    borderBottomWidth: 1,
    paddingBottom: 4,
  },
  colorStrip: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  textArea: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 16,
    lineHeight: 26,
    padding: SPACING.lg,
  },
});

// ─── New bubble sheet ─────────────────────────────────────────────────────────

function NewBubbleSheet({ onDone }: { onDone: (title: string, color: BubbleColor) => void; onCancel: () => void }) {
  const { colors, cardStyle } = useTheme();
  const [title, setTitle] = useState('');
  const [color, setColor] = useState<BubbleColor>(BUBBLE_COLORS[0]);

  return (
    <View style={[sheetStyles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <Text style={[sheetStyles.heading, { color: colors.text }]}>New bubble</Text>

      <TextInput
        style={[sheetStyles.input, { color: colors.text, borderBottomColor: colors.cardBorder }]}
        value={title}
        onChangeText={setTitle}
        placeholder="Name it (e.g. Affirmations)"
        placeholderTextColor={colors.textMuted}
        autoFocus
        returnKeyType="done"
      />

      <View style={sheetStyles.colorRow}>
        {BUBBLE_COLORS.map((c) => (
          <Pressable
            key={c}
            style={[sheetStyles.dot, { backgroundColor: c, borderWidth: c === color ? 3 : 0, borderColor: colors.text }]}
            onPress={() => setColor(c as BubbleColor)}
          />
        ))}
      </View>

      <Pressable
        style={[sheetStyles.createBtn, { backgroundColor: color, opacity: title.trim() ? 1 : 0.4 }]}
        onPress={() => { if (title.trim()) onDone(title.trim(), color); }}
        disabled={!title.trim()}
      >
        <Text style={sheetStyles.createTxt}>Create</Text>
      </Pressable>
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  card: {
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    gap: SPACING.lg,
    marginHorizontal: SPACING.lg,
  },
  heading: {
    fontFamily: FONTS.bodyBold,
    fontSize: 18,
  },
  input: {
    fontFamily: FONTS.body,
    fontSize: 16,
    borderBottomWidth: 1,
    paddingBottom: SPACING.sm,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  createBtn: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  createTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: '#fff',
  },
});

// ─── Draggable bubble node ────────────────────────────────────────────────────

function BubbleNode({
  bubble,
  scale,
  scaleAnim,
  onTap,
  onMove,
}: {
  bubble: Bubble;
  scale: number;
  scaleAnim: Animated.AnimatedNode;
  onTap: () => void;
  onMove: (dx: number, dy: number) => void;
}) {
  const { colors } = useTheme();
  const lastPos = useRef({ x: bubble.x, y: bubble.y });
  // Settled position + the live finger drag. The drag is divided by the canvas scale so
  // the bubble tracks the finger at any zoom (the canvas itself is scaled, so a raw
  // translation moved it by translation * scale on screen).
  const baseX = useRef(new Animated.Value(bubble.x)).current;
  const baseY = useRef(new Animated.Value(bubble.y)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(Animated.add(baseX, Animated.divide(dragX, scaleAnim))).current;
  const translateY = useRef(Animated.add(baseY, Animated.divide(dragY, scaleAnim))).current;

  const onPanEvent = useRef(
    Animated.event(
      [{ nativeEvent: { translationX: dragX, translationY: dragY } }],
      { useNativeDriver: true }
    )
  ).current;

  const onPanStateChange = useCallback(
    (e: PanGestureHandlerGestureEvent) => {
      if (e.nativeEvent.state === State.END || e.nativeEvent.state === State.CANCELLED) {
        const newX = lastPos.current.x + e.nativeEvent.translationX / scale;
        const newY = lastPos.current.y + e.nativeEvent.translationY / scale;
        lastPos.current = { x: newX, y: newY };
        baseX.setValue(newX);
        baseY.setValue(newY);
        dragX.setValue(0);
        dragY.setValue(0);
        onMove(newX, newY);
      }
    },
    [scale, onMove]
  );

  // Word cloud style: first 80 chars of text, split into words, scattered
  const preview = bubble.text.trim().split(/\s+/).slice(0, 12).join(' ');

  return (
    <PanGestureHandler onGestureEvent={onPanEvent} onHandlerStateChange={onPanStateChange as any}>
      <Animated.View
        style={[
          bubbleNodeStyles.bubble,
          {
            backgroundColor: bubble.color + '22',
            borderColor: bubble.color,
            transform: [{ translateX }, { translateY }],
          },
        ]}
      >
        <Pressable onPress={onTap} style={bubbleNodeStyles.inner}>
          <Text style={[bubbleNodeStyles.title, { color: bubble.color }]} numberOfLines={1}>
            {bubble.title}
          </Text>
          {preview ? (
            <Text style={[bubbleNodeStyles.preview, { color: colors.textSecondary }]} numberOfLines={3}>
              {preview}
            </Text>
          ) : (
            <Text style={[bubbleNodeStyles.empty, { color: colors.textMuted }]}>tap to write</Text>
          )}
        </Pressable>
      </Animated.View>
    </PanGestureHandler>
  );
}

const bubbleNodeStyles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    width: 160,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  inner: {
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  title: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
  },
  preview: {
    fontFamily: FONTS.body,
    fontSize: 11,
    lineHeight: 16,
  },
  empty: {
    fontFamily: FONTS.body,
    fontSize: 11,
    fontStyle: 'italic',
  },
});

// ─── Canvas ───────────────────────────────────────────────────────────────────

export default function BubblesScreen() {
  const { colors } = useTheme();
  const { bubbles, addBubble, updateBubble } = useBubblesStore();

  const [openBubble, setOpenBubble]  = useState<Bubble | null>(null);
  const [showModal,  setShowModal]   = useState(false);

  // Canvas pan + scale
  const panX  = useRef(new Animated.Value(0)).current;
  const panY  = useRef(new Animated.Value(0)).current;
  // Zoom = settled zoom × the live pinch factor (multiplicative, so a pinch composes
  // correctly with the zoom already applied).
  const baseScale  = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const scale      = useRef(Animated.multiply(baseScale, pinchScale)).current;
  const lastPan   = useRef({ x: 0, y: 0 });
  const lastScale = useRef(1);
  const [scaleNum, setScaleNum] = useState(1);

  // Canvas pan handler
  const onCanvasPan = useRef(
    Animated.event(
      [{ nativeEvent: { translationX: panX, translationY: panY } }],
      { useNativeDriver: true }
    )
  ).current;

  const onCanvasPanState = useCallback((e: PanGestureHandlerGestureEvent) => {
    if (e.nativeEvent.state === State.END) {
      lastPan.current.x += e.nativeEvent.translationX;
      lastPan.current.y += e.nativeEvent.translationY;
      panX.setOffset(lastPan.current.x);
      panY.setOffset(lastPan.current.y);
      panX.setValue(0);
      panY.setValue(0);
    } else if (e.nativeEvent.state === State.BEGAN) {
      panX.setOffset(lastPan.current.x);
      panY.setOffset(lastPan.current.y);
      panX.setValue(0);
      panY.setValue(0);
    }
  }, []);

  // Pinch handler
  const onPinch = useRef(
    Animated.event(
      [{ nativeEvent: { scale: pinchScale } }],
      { useNativeDriver: true }
    )
  ).current;

  const onPinchState = useCallback((e: PinchGestureHandlerGestureEvent) => {
    if (e.nativeEvent.state === State.END) {
      const newScale = Math.max(0.3, Math.min(3, lastScale.current * e.nativeEvent.scale));
      lastScale.current = newScale;
      baseScale.setValue(newScale);
      pinchScale.setValue(1);
      setScaleNum(newScale);
    }
  }, []);

  const createBubble = useCallback((title: string, color: BubbleColor) => {
    const id = addBubble(title, color);
    setShowModal(false);
    // Open write view immediately after creation
    const newBubble = useBubblesStore.getState().bubbles.find((b) => b.id === id);
    if (newBubble) setOpenBubble(newBubble);
  }, [addBubble]);

  // If a bubble is open for writing, show full-screen write view
  if (openBubble) {
    const latest = bubbles.find((b) => b.id === openBubble.id) ?? openBubble;
    return (
      <WriteView
        bubble={latest}
        onClose={() => setOpenBubble(null)}
      />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[canvasStyles.safe, { backgroundColor: colors.background }]}>
        {/* ── Top bar ── */}
        <View style={canvasStyles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Feather name="arrow-left" size={20} color={colors.textSecondary} />
          </Pressable>
          <Text style={[canvasStyles.title, { color: colors.text }]}>Brain Bubbles</Text>
          <Pressable
            style={[canvasStyles.addBtn, { backgroundColor: colors.accent }]}
            onPress={() => setShowModal(true)}
          >
            <Feather name="plus" size={18} color="#fff" />
          </Pressable>
        </View>

        {/* ── Canvas ── */}
        <PinchGestureHandler onGestureEvent={onPinch} onHandlerStateChange={onPinchState as any}>
          <Animated.View style={{ flex: 1 }}>
            <PanGestureHandler onGestureEvent={onCanvasPan} onHandlerStateChange={onCanvasPanState as any}>
              <Animated.View style={{ flex: 1 }}>
                <Animated.View
                  style={[
                    canvasStyles.canvas,
                    {
                      transform: [
                        { translateX: panX },
                        { translateY: panY },
                        { scale },
                      ],
                    },
                  ]}
                >
                  {bubbles.length === 0 && (
                    <View style={canvasStyles.emptyHint}>
                      <Text style={[canvasStyles.emptyIcon]}>🫧</Text>
                      <Text style={[canvasStyles.emptyText, { color: colors.textMuted }]}>
                        Tap + to create your first bubble
                      </Text>
                    </View>
                  )}
                  {bubbles.map((bubble) => (
                    <BubbleNode
                      key={bubble.id}
                      bubble={bubble}
                      scale={scaleNum}
                      scaleAnim={scale}
                      onTap={() => setOpenBubble(bubble)}
                      onMove={(x, y) => updateBubble(bubble.id, { x, y })}
                    />
                  ))}
                </Animated.View>
              </Animated.View>
            </PanGestureHandler>
          </Animated.View>
        </PinchGestureHandler>

        {/* ── New bubble modal ── */}
        <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
          <Pressable
            style={[canvasStyles.modalOverlay, { backgroundColor: colors.overlay }]}
            onPress={() => setShowModal(false)}
          >
            <Pressable>
              <NewBubbleSheet
                onDone={createBubble}
                onCancel={() => setShowModal(false)}
              />
            </Pressable>
          </Pressable>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const canvasStyles = StyleSheet.create({
  safe:   { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  title: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    width: 2000,
    height: 2000,
    position: 'relative',
  },
  emptyHint: {
    position: 'absolute',
    top: 200,
    left: 100,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyIcon: { fontSize: 48 },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 200,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
  },
});
