
import { useRef } from 'react';
import {
  Animated,
  Pressable,
} from 'react-native';

export default function PressableScale({
  children,
  style,
  disabled = false,
  onPress,
  ...rest
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => animateTo(0.97)}
      onPressOut={() => animateTo(1)}
      {...rest}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            typeof style === 'function' ? style({ pressed }) : style,
            { transform: [{ scale }] },
          ]}
        >
          {children}
        </Animated.View>
      )}
    </Pressable>
  );
}
