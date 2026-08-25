// ─── Brain Bubbles Store ──────────────────────────────────────────────────────
//
// Persists all bubbles to AsyncStorage via Zustand persist.
// Each bubble has: id, title, color, text (freeform), x/y (canvas position).
//
// Usage: const { bubbles, addBubble, updateBubble, deleteBubble } = useBubblesStore()

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type BubbleColor =
  | '#4D8BFF'  // blue
  | '#F59E0B'  // amber
  | '#EC4899'  // pink
  | '#34D399'  // mint
  | '#A78BFA'  // lavender
  | '#FB923C'  // orange
  | '#60A5FA'  // sky
  | '#F472B6'; // rose

export const BUBBLE_COLORS: BubbleColor[] = [
  '#4D8BFF', '#F59E0B', '#EC4899', '#34D399',
  '#A78BFA', '#FB923C', '#60A5FA', '#F472B6',
];

export type Bubble = {
  id:        string;
  title:     string;
  color:     BubbleColor;
  text:      string;     // freeform content
  x:         number;     // canvas position
  y:         number;
  createdAt: number;
  updatedAt: number;
};

interface BubblesState {
  bubbles: Bubble[];
  // Canvas viewport transform (persisted so user returns to same view)
  canvasX: number;
  canvasY: number;
  canvasScale: number;

  addBubble:    (title: string, color: BubbleColor) => string;  // returns new id
  updateBubble: (id: string, patch: Partial<Pick<Bubble, 'title' | 'color' | 'text' | 'x' | 'y'>>) => void;
  deleteBubble: (id: string) => void;
  setCanvasTransform: (x: number, y: number, scale: number) => void;
}

export const useBubblesStore = create<BubblesState>()(
  persist(
    (set, get) => ({
      bubbles:      [],
      canvasX:      0,
      canvasY:      0,
      canvasScale:  1,

      addBubble: (title, color) => {
        const id  = `bubble_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const now = Date.now();
        // Place new bubbles at a random offset so they don't all stack
        const x = 40 + Math.random() * 200;
        const y = 40 + Math.random() * 200;
        const bubble: Bubble = { id, title, color, text: '', x, y, createdAt: now, updatedAt: now };
        set((state) => ({ bubbles: [bubble, ...state.bubbles] }));
        return id;
      },

      updateBubble: (id, patch) => {
        const now = Date.now();
        set((state) => ({
          bubbles: state.bubbles.map((b) =>
            b.id === id ? { ...b, ...patch, updatedAt: now } : b
          ),
        }));
      },

      deleteBubble: (id) => {
        set((state) => ({ bubbles: state.bubbles.filter((b) => b.id !== id) }));
      },

      setCanvasTransform: (x, y, scale) => {
        set({ canvasX: x, canvasY: y, canvasScale: scale });
      },
    }),
    {
      name:    'nogoon-bubbles',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
