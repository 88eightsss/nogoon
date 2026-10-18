// ─── Glyph ────────────────────────────────────────────────────────────────────
// NoGoon does not use emoji. Anywhere a small picture is needed (a game, a mood, a mode, an app,
// a sticker) it is a Feather line icon, coloured from the active theme. Data fields that used to
// hold an emoji now hold a Feather icon name. Older saved data may still hold an emoji, so
// `resolveIcon` maps those to the nearest icon instead of showing a raw emoji.

import { Feather } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';

export type IconName = React.ComponentProps<typeof Feather>['name'];

const LEGACY: Record<string, IconName> = {
  // modes, games, general
  '🎯': 'target', '💼': 'briefcase', '🌙': 'moon', '📚': 'book', '🏋': 'activity', '🧘': 'heart', '🎮': 'play-circle',
  '🛌': 'moon', '☀': 'sun', '🔒': 'lock', '🌬': 'wind', '🫧': 'droplet', '🌿': 'feather', '🧩': 'grid', '👾': 'cpu',
  '👁': 'eye', '✋': 'move', '👂': 'headphones', '👃': 'wind', '👅': 'smile', '🧠': 'shield', '👹': 'alert-octagon',
  '✅': 'check-circle', '❌': 'x-circle', '🏆': 'award', '🔥': 'zap', '⚡': 'zap', '💥': 'zap', '💀': 'x-octagon',
  '🎉': 'award', '🧱': 'square', '🐦': 'send', '🏗': 'layers', '⌨': 'type', '🕵': 'search', '🟩': 'grid', '💾': 'save',
  '🔢': 'hash', '📝': 'edit-3', '💰': 'dollar-sign', '💡': 'sun', '🛡': 'shield', '🌐': 'globe', '🔕': 'bell-off',
  '🔋': 'battery', '📱': 'smartphone', '🗞': 'file-text', '🛒': 'shopping-cart', '🚀': 'send', '⚠': 'alert-triangle',
  '🔞': 'slash', '👋': 'smile', '⏰': 'clock', '⏱': 'clock', '⌚': 'watch', '📉': 'trending-down', '🎰': 'repeat',
  '🏄': 'wind', '🔄': 'refresh-cw', '📖': 'book-open', '🍳': 'coffee', '💬': 'message-circle', '🏃': 'activity',
  '✌': 'smile', '😱': 'alert-circle', '🦃': 'slash', '📊': 'bar-chart-2', '🚶': 'navigation', '💪': 'zap',
  // feelings
  '😴': 'cloud', '😰': 'wind', '😤': 'zap', '🫂': 'users', '🔁': 'repeat', '😊': 'smile', '🥹': 'heart', '😌': 'smile',
  '🤗': 'smile', '🥳': 'gift', '😭': 'cloud-drizzle', '🫶': 'heart', '🌈': 'sun', '❤': 'heart', '💛': 'heart', '✨': 'star',
  // nature / treats / doing
  '🌸': 'sun', '🌻': 'sun', '🍀': 'feather', '🌊': 'droplet', '⭐': 'star', '🦋': 'feather', '🐢': 'anchor', '🌴': 'feather',
  '🌱': 'feather', '🍉': 'circle', '🍓': 'circle', '🥭': 'circle', '🍵': 'coffee', '🍪': 'circle', '🥑': 'circle',
  '🧋': 'coffee', '🍜': 'coffee', '🍙': 'circle', '🍍': 'circle', '☕': 'coffee', '🍰': 'gift', '✏': 'edit-2',
  '🎧': 'headphones', '📞': 'phone', '🎨': 'edit-3', '🎸': 'music', '🧹': 'trash-2', '🌅': 'sunrise', '📌': 'map-pin',
  '🔑': 'key', '➡': 'arrow-right', '❗': 'alert-circle', '🎀': 'gift', '📓': 'book', '🎵': 'music', '📸': 'camera',
  '▶': 'play', '🤖': 'cpu', '👥': 'users', '👻': 'eye-off', '🟣': 'circle', '👤': 'user', '📷': 'camera', '🎬': 'film',
  '🎥': 'video', '📦': 'package', '👗': 'shopping-bag', '⚔': 'x', '🟥': 'square',
};

const fallback: IconName = 'circle';

/** A Feather icon name for whatever was stored: a name already, a legacy emoji, or a safe default. */
export function resolveIcon(key?: string | null): IconName {
  if (!key) return fallback;
  if (Object.prototype.hasOwnProperty.call(Feather.glyphMap, key)) return key as IconName;
  const bare = key.replace(/️/g, '');
  return LEGACY[bare] ?? LEGACY[Array.from(bare)[0] ?? ''] ?? fallback;
}

export function Glyph({ name, size = 20, color, style }: {
  name?: string | null; size?: number; color: string; style?: StyleProp<TextStyle>;
}) {
  return <Feather name={resolveIcon(name)} size={size} color={color} style={style} />;
}
