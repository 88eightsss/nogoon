import type { PackManifest } from './types';

// Tokyo: Japanese-adjacent. English carries the meaning; kanji are decoration
// (stamps, charms, fortune names). Hidden until unlocked: 7-day streak, the code
// TOKYO, or the secret tap on the My Page greeting.
export const TOKYO_PACK: PackManifest = {
  format: 1,
  id: 'tokyo',
  name: 'Tokyo',
  tagline: 'Shrine meets keitai-era web',
  version: 1,
  hidden: true,
  unlock: { code: 'TOKYO', streak: 7, tap: true },
  parts: {
    theme: {
      nativeMode: 'light',
      dark: {
        background: '#0F1633', surface: '#182046', surfaceHigh: '#222C5E',
        accent: '#FF4F7B', accentBright: '#FF8AA8',
        text: '#EAF0FF', textSecondary: '#A3B3E2', textMuted: '#7F8FC4',
        protect: '#3DF2C0', calm: '#FFB27A', arcade: '#C7A6FF', me: '#7CC4FF',
      },
      light: {
        background: '#FFF8F4', surface: '#FFFFFF', surfaceHigh: '#FBEAE6',
        accent: '#D8453B', accentBright: '#E8695F',
        text: '#3B2A33', textSecondary: '#6A5560', textMuted: '#8F7A82',
      },
    },
    shape: { borderId: 'soft' },
    page: {
      frame: 'egg', counter: 'tiles', stamps: 'hanko', gate: 'shrine',
      look: {
        shell: '#F5A9C0', bezel: '#FFF3EE', lcdBg: '#D9E6BC', lcdInk: '#2C3B20',
        mark: '#D3382C', wood: '#E4BE8E', woodInk: '#4B3220',
      },
    },
  },
};

export type Voice = 'gentle' | 'hype' | 'dry';

// Omikuji fortunes: the gate line, one slip per gate. 4 fortunes x 3 voices.
export const FORTUNES: { kanji: string; number: string; meaning: string; lines: Record<Voice, string> }[] = [
  { kanji: '大吉', number: '第三番', meaning: 'great blessing', lines: {
    gentle: 'Today leans your way. Whatever you came here to escape will keep.',
    hype:   'Absolute S-tier day. Close the app and go collect the win.',
    dry:    'Good luck, statistically. The feed is not part of it.' } },
  { kanji: '中吉', number: '第七番', meaning: 'middle blessing', lines: {
    gentle: 'A steady day. One quiet minute now helps the whole afternoon.',
    hype:   'You are mid-quest. Do not pick up the side-scroll.',
    dry:    'Fortune says: fine. So is not opening this.' } },
  { kanji: '小吉', number: '第十二番', meaning: 'small blessing', lines: {
    gentle: 'A small good thing is close. Step away and you will find it.',
    hype:   'Tiny blessing, huge dub. Take it.',
    dry:    'Small luck. Still bigger than whatever is in that app.' } },
  { kanji: '末吉', number: '第二十番', meaning: 'future blessing', lines: {
    gentle: 'Good fortune comes later. It tends to, for people who wait.',
    hype:   'Slow start, legendary ending. Trust the arc.',
    dry:    'Luck arrives late. So does regret, if you open it.' } },
];
