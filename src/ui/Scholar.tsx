import { useEffect, useState } from 'react';
import { AccessibilityInfo, Image, View } from 'react-native';
import sprite from '../../assets/scholar/spritesheet.webp';
import { scholarMotion, type ScholarState } from '../domain/scholarMotion';

const COLUMNS = 8;
const ROWS = 11;

export function Scholar({ state = 'study', width = 110, height = 119 }: { state?: ScholarState; width?: number; height?: number }) {
  const [pose, setPose] = useState(() => scholarMotion(state, 0)[0]);
  useEffect(() => {
    let stopped = false;
    let reduced = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { reduced = value; });
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { reduced = value; });
    let turn = 0;
    let index = 0;
    let sequence = scholarMotion(state, turn);
    const tick = () => {
      if (stopped) return;
      if (reduced) {
        setPose({ row: state === 'celebrate' ? 8 : 0, frame: state === 'celebrate' ? 5 : 0, hold: 0, blend: 0, action: 'rest' });
        return;
      }
      const frame = sequence[index];
      setPose(frame);
      timer = setTimeout(() => {
        index += 1;
        if (index >= sequence.length) {
          sequence = scholarMotion(state, turn + 1);
          turn += 1;
          index = 0;
        }
        tick();
      }, frame.hold);
    };
    tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, [state]);
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width, height, overflow: 'hidden' }}>
    <Image accessibilityIgnoresInvertColors resizeMode="stretch" source={sprite} style={{ width: width * COLUMNS, height: height * ROWS, transform: [{ translateX: -pose.frame * width }, { translateY: -pose.row * height }] }} />
  </View>;
}
