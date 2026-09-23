// ─── GoonWord — classic Wordle ─────────────────────────────────────────────────
//
// Exact Wordle design: 6 rows × 4 tiles, all visible at once. A fresh secret
// word is picked at random from the dictionary each game (not always GOON —
// same idea as real Wordle's own title never being the answer).
// Green = right letter, right place.
// Yellow = right letter, wrong place.
// Gray = not in word.

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, Animated,
} from 'react-native';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import * as Haptics from 'expo-haptics';

// ─── Constants ────────────────────────────────────────────────────────────────

const WORD_LEN   = 4;
const MAX_ROWS   = 6;
const TILE_SIZE  = 62;
const TILE_GAP   = 6;

// Wordle-authentic palette
const C = {
  bg:       '#121213',
  surface:  '#1a1a1b',
  border:   '#3a3a3c',
  active:   '#565758',
  correct:  '#538d4e',
  present:  '#b59f3b',
  absent:   '#3a3a3c',
  text:     '#ffffff',
  keyBg:    '#818384',
  keyText:  '#ffffff',
};

type TileState = 'empty' | 'active' | 'correct' | 'present' | 'absent';
type GuessResult = { letter: string; state: TileState }[];

// ─── Valid words ──────────────────────────────────────────────────────────────

const VALID_WORDS = new Set([
  'ABLE','ACID','AGED','ALSO','AREA','ARMY','AUNT','BABY','BACK','BALL',
  'BAND','BANK','BASE','BATH','BEAR','BEAT','BEEN','BELL','BELT','BEST',
  'BIKE','BILL','BIRD','BITE','BLOW','BLUE','BOAT','BODY','BOMB','BOND',
  'BONE','BOOK','BOOM','BORE','BORN','BOSS','BOTH','BOWL','BURN','BUSH',
  'BUSY','CAFE','CAGE','CAKE','CALL','CALM','CAME','CARD','CARE','CART',
  'CASE','CASH','CAST','CAVE','CELL','CHAT','CHIP','CITY','CLAM','CLAN',
  'CLAP','CLAY','CLIP','CLUB','CLUE','COAT','CODE','COIL','COLD','COME',
  'COOK','COOL','COPE','COPY','CORD','CORE','CORN','COST','COUP','COZY',
  'CREW','CROP','CROW','CUBE','CURE','CURL','CUTE','DAMP','DARK','DART',
  'DASH','DATE','DAWN','DAYS','DEAD','DEAR','DEBT','DECK','DEED','DEEP',
  'DEER','DEMO','DENY','DESK','DIET','DIME','DINE','DIRT','DISH','DISK',
  'DIVE','DOCK','DOES','DONE','DOOR','DOSE','DOTS','DOWN','DRAG','DRAW',
  'DREW','DRIP','DROP','DRUM','DUAL','DUDE','DULL','DUMB','DUNE','DUST',
  'DUTY','EACH','EARN','EASE','EAST','EASY','EDGE','ELSE','EMIT','ENVY',
  'EPIC','EVEN','EVER','EXAM','EXIT','EYES','FACE','FACT','FAIL','FAKE',
  'FALL','FAME','FARM','FAST','FATE','FEAT','FEEL','FEET','FELL','FELT',
  'FILE','FILL','FILM','FIND','FINE','FIRE','FIRM','FISH','FIST','FIVE',
  'FLAG','FLAT','FLEW','FLIP','FLOW','FOAM','FOLD','FOLK','FOND','FONT',
  'FOOD','FOOL','FOOT','FORD','FORE','FORK','FORM','FORT','FOUL','FOUR',
  'FREE','FROM','FUEL','FULL','FUME','FUND','FURY','FUSE','GALE','GAME',
  'GANG','GAVE','GAZE','GEAR','GERM','GIFT','GIRL','GIVE','GLAD','GLEE',
  'GLOW','GLUE','GOAL','GOAT','GOLD','GOLF','GONE','GOOD','GOOF','GOON',
  'GORE','GUST','HACK','HAIL','HAIR','HALF','HALL','HALT','HAND','HANG',
  'HARD','HARM','HARP','HAVE','HAWK','HEAD','HEAL','HEAP','HEAT','HEEL',
  'HELD','HELL','HELP','HERE','HERO','HIGH','HILL','HINT','HIRE','HOLD',
  'HOLE','HOME','HOOK','HOPE','HORN','HOST','HOUR','HUGE','HULL','HUNG',
  'HUNT','HURT','ICON','IDEA','IDLE','INCH','INTO','IRON','ISLE','ITEM',
  'JAIL','JANE','JAZZ','JEST','JOIN','JOKE','JUMP','JUST','KEEN','KEEP',
  'KICK','KIND','KING','KNEW','KNOT','KNOW','LACK','LAKE','LAND','LANE',
  'LAST','LATE','LAWN','LEAD','LEAF','LEAK','LEAN','LEAP','LEFT','LEND',
  'LENS','LESS','LEST','LIFT','LIKE','LILY','LIME','LINE','LINK','LION',
  'LIST','LIVE','LOAD','LOAN','LOCK','LOFT','LONE','LONG','LOOK','LOOP',
  'LORD','LORE','LOSE','LOSS','LOST','LOUD','LOVE','LUCK','LURE','LURK',
  'MADE','MAIL','MAIN','MAKE','MALE','MALL','MANY','MARK','MASK','MATE',
  'MAZE','MEAL','MEAN','MEET','MILD','MILE','MILK','MILL','MIND','MINE',
  'MISS','MODE','MOLD','MOON','MORE','MOST','MOVE','MUCH','MUST','MYTH',
  'NAIL','NAME','NAVY','NEAR','NECK','NEED','NEST','NEWS','NEXT','NICE',
  'NINE','NODE','NONE','NOON','NORM','NOSE','NOTE','NOUN','NUDE','OBEY',
  'ONCE','ONLY','OPEN','ORAL','ORCA','OVER','OVEN','PACK','PAGE','PAID',
  'PAIN','PAIR','PALE','PALM','PARK','PART','PASS','PAST','PATH','PAVE',
  'PEAK','PEAR','PEEL','PEER','PERK','PEST','PICK','PILL','PINE','PINK',
  'PIPE','PLAN','PLAY','PLOT','PLOW','PLUG','PLUS','POEM','POET','POLE',
  'POLL','POND','POOL','POOR','PORT','POSE','POST','POUR','PREY','PROM',
  'PROP','PULL','PUMP','PURE','PUSH','RACE','RACK','RAID','RAIL','RAIN',
  'RAKE','RAMP','RANG','RANK','RARE','RASH','RATE','READ','REAL','REAP',
  'REAR','REEL','RELY','RENT','REST','RICE','RICH','RIDE','RING','RINK',
  'RISE','RISK','ROAD','ROAM','ROAR','ROBE','ROCK','RODE','ROLE','ROLL',
  'ROOF','ROOM','ROOT','ROPE','ROSE','RUIN','RULE','RUSH','RUST','SAFE',
  'SAGE','SAIL','SAKE','SALE','SALT','SAME','SAND','SANE','SANG','SAVE',
  'SEAL','SEAM','SEAT','SEEM','SELF','SELL','SEND','SENT','SHED','SHIP',
  'SHOE','SHOP','SHOT','SHOW','SHUT','SICK','SIDE','SIGH','SIGN','SILK',
  'SINK','SIZE','SKIN','SKIP','SLAM','SLAP','SLIM','SLIP','SLOW','SLUG',
  'SNAP','SOAR','SOCK','SOFT','SOIL','SOLD','SOLE','SOME','SOON','SORT',
  'SOUL','SOUP','SOUR','SPAN','SPIN','SPOT','STUB','SUCH','SUIT','SUNG',
  'SURE','SWAN','SWAP','SWIM','TALE','TALL','TAME','TANK','TAPE','TASK',
  'TEAM','TEAR','TEEN','TELL','TEND','TENT','TERM','TEST','TEXT','THAN',
  'THEN','THEY','THIN','THIS','TIDE','TILL','TIME','TINY','TIRE','TOLD',
  'TOLL','TOME','TONE','TOOL','TORN','TOSS','TOUR','TOWN','TRAP','TREE',
  'TRIM','TRIO','TRIP','TRUE','TUBE','TUCK','TUNE','TURN','TWIN','TYPE',
  'UNIT','UPON','USED','VAIN','VALE','VAMP','VEIL','VIEW','VINE','VOID',
  'VOLT','WAIL','WAKE','WALK','WALL','WAND','WARM','WARN','WARP','WARY',
  'WASH','WASP','WAVE','WEAK','WELD','WELL','WENT','WERE','WEST','WHAT',
  'WHEN','WHOM','WIDE','WILD','WILL','WIND','WINE','WING','WINK','WISE',
  'WISH','WITH','WOKE','WOLF','WOOD','WOOL','WORD','WORE','WORK','WORM',
  'WORN','WRAP','WREN','WRIT','YARD','YARN','YEAR','YOUR','ZEAL','ZERO',
  'ZEST','ZONE','ZOOM',
]);

// ─── Pick a secret word ─────────────────────────────────────────────────────
// A fresh target chosen at random from the dictionary each game (GOON is
// one of the possible answers, same odds as any other word — it just isn't
// guaranteed).

const WORD_POOL = Array.from(VALID_WORDS);

function pickTarget(): string {
  return WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)];
}

// ─── Evaluate guess ───────────────────────────────────────────────────────────

function evaluate(guess: string, target: string): GuessResult {
  const result: GuessResult = Array.from({ length: WORD_LEN }, (_, i) => ({
    letter: guess[i],
    state: 'absent' as TileState,
  }));
  const remaining: (string | null)[] = target.split('');
  for (let i = 0; i < WORD_LEN; i++) {
    if (guess[i] === target[i]) {
      result[i].state = 'correct';
      remaining[i] = null;
    }
  }
  for (let i = 0; i < WORD_LEN; i++) {
    if (result[i].state === 'correct') continue;
    const idx = remaining.indexOf(guess[i]);
    if (idx !== -1) {
      result[i].state = 'present';
      remaining[idx] = null;
    }
  }
  return result;
}

// ─── Tile ─────────────────────────────────────────────────────────────────────

function Tile({ letter, state, flipAnim }: {
  letter: string;
  state: TileState;
  flipAnim?: Animated.Value;
}) {
  const bg: Record<TileState, string> = {
    empty:   C.bg,
    active:  C.bg,
    correct: C.correct,
    present: C.present,
    absent:  C.absent,
  };
  const borderColor = state === 'active' ? C.active : state === 'empty' ? C.border : 'transparent';

  const rotateY = flipAnim
    ? flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '90deg', '0deg'] })
    : '0deg';

  const bgColor = flipAnim
    ? flipAnim.interpolate({
        inputRange: [0, 0.49, 0.5, 1],
        outputRange: [C.bg, C.bg, bg[state], bg[state]],
      })
    : bg[state];

  return (
    <Animated.View
      style={[
        tileStyles.tile,
        {
          backgroundColor: bgColor as any,
          borderColor,
          borderWidth: state === 'empty' || state === 'active' ? 2 : 0,
          transform: [{ rotateY }],
        },
      ]}
    >
      <Text style={tileStyles.letter}>{letter}</Text>
    </Animated.View>
  );
}

const tileStyles = StyleSheet.create({
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontFamily: FONTS.bodyBold,
    fontSize: 28,
    color: C.text,
    textTransform: 'uppercase',
  },
});

// ─── Keyboard ─────────────────────────────────────────────────────────────────

const KB_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

function Key({ label, letterState, onPress, wide }: {
  label: string;
  letterState: TileState;
  onPress: () => void;
  wide?: boolean;
}) {
  const bg =
    letterState === 'correct' ? C.correct :
    letterState === 'present' ? C.present :
    letterState === 'absent'  ? C.absent  : C.keyBg;

  return (
    <Pressable
      style={[keyStyles.key, { backgroundColor: bg, minWidth: wide ? 52 : 36 }]}
      onPress={onPress}
    >
      <Text style={keyStyles.label}>{label}</Text>
    </Pressable>
  );
}

const keyStyles = StyleSheet.create({
  key: {
    height: 56,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  label: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: C.keyText,
  },
});

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function GoonWord({ onComplete }: { onComplete: (won: boolean) => void }) {
  // Picked once per game — the secret word this round.
  const [target] = useState(() => pickTarget());

  const [guesses, setGuesses]   = useState<GuessResult[]>([]);
  const [current, setCurrent]   = useState('');
  const [toast,   setToast]     = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon]           = useState(false);

  // One flip animation per submitted row
  const flipAnims = useRef<Animated.Value[]>(
    Array.from({ length: MAX_ROWS }, () => new Animated.Value(0))
  ).current;

  // Shake animation for invalid guesses
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Letter → best tile state for keyboard coloring
  const letterMap = useRef<Record<string, TileState>>({});
  for (const g of guesses) {
    for (const { letter, state } of g) {
      const prev = letterMap.current[letter] ?? 'empty';
      const rank: TileState[] = ['correct', 'present', 'absent', 'empty'];
      if (rank.indexOf(state) < rank.indexOf(prev)) {
        letterMap.current[letter] = state;
      }
    }
  }

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 1500);
  };

  const flipRow = (row: number, onDone: () => void) => {
    flipAnims[row].setValue(0);
    Animated.timing(flipAnims[row], {
      toValue: 1,
      duration: 500,
      useNativeDriver: false,
    }).start(onDone);
  };

  const submit = useCallback(() => {
    if (current.length < WORD_LEN) {
      showToast('Not enough letters');
      shake();
      return;
    }
    if (!VALID_WORDS.has(current)) {
      showToast('Not in word list');
      shake();
      return;
    }

    const result = evaluate(current, target);
    const row = guesses.length;
    const newGuesses = [...guesses, result];
    setGuesses(newGuesses);
    setCurrent('');

    flipRow(row, () => {
      const didWin = result.every((t) => t.state === 'correct');
      if (didWin) {
        const msgs = ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'];
        showToast(msgs[Math.min(row, msgs.length - 1)]);
        setWon(true);
        setGameOver(true);
        setTimeout(() => onComplete(true), 1500);
      } else if (newGuesses.length >= MAX_ROWS) {
        showToast(target);
        setGameOver(true);
        setTimeout(() => onComplete(false), 2000);
      }
    });
  }, [current, guesses, target, onComplete]);

  const pressKey = useCallback((key: string) => {
    if (gameOver) return;
    if (key === 'ENTER') {
      submit();
    } else if (key === '⌫') {
      setCurrent((c) => c.slice(0, -1));
    } else if (current.length < WORD_LEN) {
      setCurrent((c) => c + key);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [gameOver, current, submit]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.wrap}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.divider} />
        <Text style={styles.title}>GOON</Text>
        <View style={styles.divider} />
      </View>

      {/* Toast */}
      {!!toast && (
        <View style={styles.toastWrap}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {/* Grid */}
      <View style={styles.grid}>
        {Array.from({ length: MAX_ROWS }, (_, row) => {
          const guess = guesses[row];
          const isCur = row === guesses.length && !gameOver;

          return (
            <Animated.View
              key={row}
              style={[
                styles.row,
                isCur && { transform: [{ translateX: shakeAnim }] },
              ]}
            >
              {Array.from({ length: WORD_LEN }, (_, col) => {
                if (guess) {
                  return (
                    <Tile
                      key={col}
                      letter={guess[col].letter}
                      state={guess[col].state}
                      flipAnim={flipAnims[row]}
                    />
                  );
                }
                if (isCur) {
                  const letter = current[col] ?? '';
                  return (
                    <Tile key={col} letter={letter} state={letter ? 'active' : 'empty'} />
                  );
                }
                return <Tile key={col} letter="" state="empty" />;
              })}
            </Animated.View>
          );
        })}
      </View>

      {/* Keyboard */}
      <View style={styles.keyboard}>
        {KB_ROWS.map((row, ri) => (
          <View key={ri} style={styles.keyRow}>
            {ri === 2 && (
              <Key label="ENTER" letterState="empty" wide onPress={() => pressKey('ENTER')} />
            )}
            {row.split('').map((k) => (
              <Key
                key={k}
                label={k}
                letterState={letterMap.current[k] ?? 'empty'}
                onPress={() => pressKey(k)}
              />
            ))}
            {ri === 2 && (
              <Key label="⌫" letterState="empty" wide onPress={() => pressKey('⌫')} />
            )}
          </View>
        ))}
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: SPACING.lg,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  title: {
    fontFamily: FONTS.bodyBold,
    fontSize: 20,
    color: C.text,
    letterSpacing: 4,
    paddingHorizontal: SPACING.md,
  },

  toastWrap: {
    position: 'absolute',
    top: 80,
    backgroundColor: C.text,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    zIndex: 10,
  },
  toastText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: C.bg,
  },

  grid: {
    gap: TILE_GAP,
    marginBottom: SPACING.xl,
  },
  row: {
    flexDirection: 'row',
    gap: TILE_GAP,
  },

  keyboard: {
    width: '100%',
    paddingHorizontal: 6,
    gap: 8,
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
});
