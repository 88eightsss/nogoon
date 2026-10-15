// Scrolling banner text (Webcore). Loops right-to-left; respects nothing fancy.

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';

export function Marquee({ text, color, bg, font }: { text: string; color: string; bg: string; font?: string }) {
  const x = useRef(new Animated.Value(0)).current;
  const [cw, setCw] = useState(0);
  const [tw, setTw] = useState(0);

  useEffect(() => {
    if (!cw || !tw) return;
    x.setValue(cw);
    const loop = Animated.loop(
      Animated.timing(x, { toValue: -tw, duration: (cw + tw) * 22, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [cw, tw, x]);

  return (
    <View style={[styles.wrap, { backgroundColor: bg }]} onLayout={(e: LayoutChangeEvent) => setCw(e.nativeEvent.layout.width)}>
      <Animated.View style={{ transform: [{ translateX: x }], alignSelf: 'flex-start' }}>
        <Text
          numberOfLines={1}
          onLayout={(e: LayoutChangeEvent) => setTw(e.nativeEvent.layout.width)}
          style={{ color, fontFamily: font, fontSize: 12, width: undefined }}
        >
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 28, borderRadius: 14, overflow: 'hidden', justifyContent: 'center' },
});
