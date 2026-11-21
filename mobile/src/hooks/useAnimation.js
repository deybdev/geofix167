
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

export { Animated };

export function useEntranceAnimation(duration = 450) {
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [enter, duration]);

  return {
    opacity: enter,
    transform: [
      {
        translateY: enter.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
    ],
  };
}

export function useShakeAnimation() {
  const shake = useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    shake.stopAnimation();
    shake.setValue(0);

    Animated.sequence([
      Animated.timing(shake, {
        toValue: 8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: -8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: 5,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return {
    shakeStyle: {
      transform: [{ translateX: shake }],
    },
    triggerShake,
  };
}
