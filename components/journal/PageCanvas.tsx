// ─── One journal page: paper, writing, stickers and doodles ───────────────────
// Layers, bottom to top: paper + pattern + frame, the text, doodle strokes, stickers, and (only
// while drawing) a transparent sheet that catches the pen. Sticker positions are stored as fractions
// of the page; strokes are stored in a fixed 1000-unit space so a page looks the same on any phone.

import { memo, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { View, Text, TextInput, PanResponder, Animated, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { FONTS } from '@/constants/Colors';
import { PAPERS, TEXT_SIZES } from '@/constants/journalStyles';
import type { JournalPage, PageSticker } from '@/stores/useJournalStore';
import { PackSprite } from '@/components/page/PackSprite';
import type { CharacterId } from '@/stores/usePetStore';

export const PAGE_RATIO = 1.3;
const VIEW_W = 1000;

export type CanvasMode = 'write' | 'style' | 'stickers' | 'draw';

export function paperOf(page: Pick<JournalPage, 'paper'>) {
  return PAPERS.find((p) => p.id === page.paper) ?? PAPERS[0];
}
export function inkOf(page: Pick<JournalPage, 'paper' | 'ink'>) {
  return page.ink ?? paperOf(page).ink;
}
function fontFamily(f: JournalPage['font']) {
  return f === 'bold' ? FONTS.display : f === 'type' ? FONTS.mono : FONTS.body;
}
export function lineHeightFor(page: Pick<JournalPage, 'sizeIdx' | 'easyRead'>) {
  const fs = TEXT_SIZES[page.sizeIdx] ?? 18;
  return Math.round(fs * (page.easyRead ? 1.95 : 1.55));
}

const PAD_X = 20;
const PAD_T = 16;

// ─── Pattern lines / dots / grid ────────────────────────────────────────────────
function Pattern({ page, W, H }: { page: JournalPage; W: number; H: number }) {
  const ink = inkOf(page);
  const lh = lineHeightFor(page);
  const c = ink + '33';
  if (page.pattern === 'plain') return null;
  const els: ReactElement[] = [];
  if (page.pattern === 'lined') {
    for (let y = PAD_T + lh * 0.9, k = 0; y < H - 6; y += lh, k++) {
      els.push(<Line key={k} x1={PAD_X - 6} x2={W - PAD_X + 6} y1={y} y2={y} stroke={c} strokeWidth={1} />);
    }
  } else if (page.pattern === 'grid') {
    const g = 26;
    for (let x = g; x < W; x += g) els.push(<Line key={`v${x}`} x1={x} x2={x} y1={0} y2={H} stroke={c} strokeWidth={1} />);
    for (let y = g; y < H; y += g) els.push(<Line key={`h${y}`} x1={0} x2={W} y1={y} y2={y} stroke={c} strokeWidth={1} />);
  } else {
    const g = 26;
    for (let x = g; x < W; x += g) for (let y = g; y < H; y += g) els.push(<Circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} fill={ink + '55'} />);
  }
  return <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">{els}</Svg>;
}

function Frame({ page, W, H }: { page: JournalPage; W: number; H: number }) {
  const ink = inkOf(page);
  if (page.frame === 'none') return null;
  if (page.frame === 'tape') {
    const tape = (left: boolean) => (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', top: -6, [left ? 'left' : 'right']: -16, width: 84, height: 24,
          backgroundColor: left ? 'rgba(255,170,200,0.75)' : 'rgba(150,210,255,0.75)',
          transform: [{ rotate: left ? '-32deg' : '32deg' }],
        }}
      />
    );
    return <>{tape(true)}{tape(false)}</>;
  }
  if (page.frame === 'dashed') {
    return <View pointerEvents="none" style={{ position: 'absolute', left: 8, top: 8, right: 8, bottom: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: ink + '88', borderRadius: 14 }} />;
  }
  return (
    <>
      <View pointerEvents="none" style={{ position: 'absolute', left: 6, top: 6, right: 6, bottom: 6, borderWidth: 2, borderColor: ink + '99', borderRadius: 6 }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 12, top: 12, right: 12, bottom: 12, borderWidth: 1, borderColor: ink + '66', borderRadius: 3 }} />
    </>
  );
}

// ─── A draggable sticker ────────────────────────────────────────────────────────
const StickerView = memo(function StickerView({
  s, W, H, selected, onSelect, onMove, onDrag,
}: {
  s: PageSticker; W: number; H: number; selected: boolean;
  onSelect: (id: string) => void; onMove: (id: string, x: number, y: number) => void; onDrag: (dragging: boolean) => void;
}) {
  const isMascot = s.glyph.startsWith('m:');
  const fs = 34 * s.size;
  const box = isMascot ? 36 * s.size * 1.6 : fs * 1.35;
  const [pos, setPos] = useState({ x: s.x, y: s.y });
  useEffect(() => { setPos({ x: s.x, y: s.y }); }, [s.x, s.y]);
  const t = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const start = useRef({ x: 0, y: 0 });
  const live = useRef({ W, H, id: s.id, pos });
  live.current = { W, H, id: s.id, pos };
  const cb = useRef({ onSelect, onMove, onDrag });
  cb.current = { onSelect, onMove, onDrag };

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { start.current = { ...live.current.pos }; cb.current.onDrag(true); },
    onPanResponderMove: (_, g) => { t.setValue({ x: g.dx, y: g.dy }); },
    onPanResponderRelease: (_, g) => {
      cb.current.onDrag(false);
      const { W: w, H: h, id } = live.current;
      if (Math.abs(g.dx) < 5 && Math.abs(g.dy) < 5) { cb.current.onSelect(id); t.setValue({ x: 0, y: 0 }); return; }
      const nx = Math.min(1, Math.max(0, start.current.x + g.dx / w));
      const ny = Math.min(1, Math.max(0, start.current.y + g.dy / h));
      setPos({ x: nx, y: ny });
      t.setValue({ x: 0, y: 0 });
      cb.current.onMove(id, nx, ny);
    },
    onPanResponderTerminate: () => { cb.current.onDrag(false); t.setValue({ x: 0, y: 0 }); },
  }), [t]);

  return (
    <Animated.View
      {...pan.panHandlers}
      accessible
      accessibilityLabel="Sticker. Drag to move, tap to edit."
      style={{
        position: 'absolute',
        left: pos.x * W - box / 2, top: pos.y * H - box / 2, width: box, height: box,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: selected ? 2 : 0, borderStyle: 'dashed', borderColor: '#4d8bff', borderRadius: 10,
        transform: [{ translateX: t.x }, { translateY: t.y }, { rotate: `${s.rot}deg` }],
      }}
    >
      {isMascot ? (
        <PackSprite char={Number(s.glyph.slice(2)) as CharacterId} stage={2} cell={3 * s.size} />
      ) : (
        <Text style={{ fontSize: fs, lineHeight: fs * 1.25 }}>{s.glyph.slice(2)}</Text>
      )}
    </Animated.View>
  );
});

// ─── The page ───────────────────────────────────────────────────────────────────
export function PageCanvas({
  page, W, H, mode, penColor, penWidth, selectedSticker, onSelectSticker, onDragState, onChange,
}: {
  page: JournalPage; W: number; H: number; mode: CanvasMode; penColor: string; penWidth: number;
  selectedSticker: string | null; onSelectSticker: (id: string | null) => void;
  onDragState: (busy: boolean) => void;
  onChange: (patch: Partial<JournalPage>) => void;
}) {
  const paper = paperOf(page);
  const ink = inkOf(page);
  const fs = TEXT_SIZES[page.sizeIdx] ?? 18;
  const lh = lineHeightFor(page);

  // ── text: typed locally, saved to the store a moment after you pause (and on blur / leaving) ──
  const [text, setText] = useState(page.body);
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingText = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const flushText = () => {
    if (typing.current) { clearTimeout(typing.current); typing.current = null; }
    if (pendingText.current !== null) { onChangeRef.current({ body: pendingText.current }); pendingText.current = null; }
  };
  useEffect(() => { if (pendingText.current === null) setText(page.body); }, [page.body]);
  useEffect(() => flushText, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── pen ──
  const [live, setLive] = useState<string | null>(null);
  const pen = useRef({ d: '', last: { x: 0, y: 0 }, n: 0 });
  const latest = useRef({ page, penColor, penWidth, W, H, onChange, onDragState });
  latest.current = { page, penColor, penWidth, W, H, onChange, onDragState };

  const penPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      const { W: w, H: h, onDragState: busy } = latest.current;
      busy(true);
      const x = (e.nativeEvent.locationX / w) * VIEW_W;
      const y = (e.nativeEvent.locationY / h) * VIEW_W * PAGE_RATIO;
      pen.current = { d: `M${x.toFixed(1)} ${y.toFixed(1)} L${(x + 0.1).toFixed(1)} ${y.toFixed(1)}`, last: { x, y }, n: 0 };
      setLive(pen.current.d);
    },
    onPanResponderMove: (e) => {
      const { W: w, H: h } = latest.current;
      const x = (e.nativeEvent.locationX / w) * VIEW_W;
      const y = (e.nativeEvent.locationY / h) * VIEW_W * PAGE_RATIO;
      const dx = x - pen.current.last.x, dy = y - pen.current.last.y;
      if (dx * dx + dy * dy < 4) return;
      pen.current.d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
      pen.current.last = { x, y };
      pen.current.n += 1;
      setLive(pen.current.d);
    },
    onPanResponderRelease: () => finish(),
    onPanResponderTerminate: () => finish(),
  }), []);   // eslint-disable-line react-hooks/exhaustive-deps

  function finish() {
    const { page: p, penColor: c, penWidth: wd, onChange: change, onDragState: busy } = latest.current;
    busy(false);
    const d = pen.current.d;
    pen.current = { d: '', last: { x: 0, y: 0 }, n: 0 };
    setLive(null);
    if (!d) return;
    change({ strokes: [...p.strokes, { id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, color: c, width: wd, d }] });
  }

  const moveSticker = (id: string, x: number, y: number) =>
    onChange({ stickers: page.stickers.map((s) => (s.id === id ? { ...s, x, y } : s)) });

  return (
    <View style={{ width: W, height: H, backgroundColor: paper.color, borderRadius: 18, overflow: 'visible' }}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: 18, overflow: 'hidden' }]}>
        <Pattern page={page} W={W} H={H} />
      </View>
      <Frame page={page} W={W} H={H} />

      <TextInput
        style={{
          position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
          paddingHorizontal: PAD_X, paddingTop: PAD_T, paddingBottom: 18,
          color: ink, fontFamily: fontFamily(page.font), fontSize: fs, lineHeight: lh,
          letterSpacing: page.easyRead ? 0.7 : 0, textAlignVertical: 'top',
        }}
        value={text}
        onChangeText={(t) => {
          setText(t);
          pendingText.current = t;
          if (typing.current) clearTimeout(typing.current);
          typing.current = setTimeout(flushText, 450);
        }}
        onBlur={flushText}
        onFocus={() => onSelectSticker(null)}
        multiline
        scrollEnabled
        editable={mode !== 'draw'}
        placeholder="Write here. Nobody else will read it."
        placeholderTextColor={ink + '77'}
        accessibilityLabel="Journal page text"
      />

      <Svg
        width={W} height={H} viewBox={`0 0 ${VIEW_W} ${VIEW_W * PAGE_RATIO}`}
        style={StyleSheet.absoluteFill} pointerEvents="none"
      >
        {page.strokes.map((s) => (
          <Path key={s.id} d={s.d} stroke={s.color} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ))}
        {live ? <Path d={live} stroke={penColor} strokeWidth={penWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
      </Svg>

      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {page.stickers.map((s) => (
          <StickerView
            key={s.id} s={s} W={W} H={H} selected={selectedSticker === s.id}
            onSelect={onSelectSticker} onMove={moveSticker} onDrag={onDragState}
          />
        ))}
      </View>

      {mode === 'draw' ? (
        <View style={StyleSheet.absoluteFill} {...penPan.panHandlers} accessibilityLabel="Drawing surface" />
      ) : null}
    </View>
  );
}
