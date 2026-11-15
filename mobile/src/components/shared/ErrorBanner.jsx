
import { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  Text,
} from 'react-native';
import tw from 'twrnc';

export default function AnimatedErrorBanner({
  message,
  onDismiss,
}) {
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;

    shake.setValue(0);

    const animation = Animated.sequence([
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
    ]);

    animation.start();

    return () => animation.stop();
  }, [message, shake]);

  if (!message) return null;

  return (
    <Animated.View
      accessibilityRole="alert"
      style={[
        tw`flex-row items-center justify-between rounded-xl border border-red-100 bg-red-50 px-4 py-3`,
        {
          transform: [{ translateX: shake }],
        },
      ]}
    >
      <Text style={tw`flex-1 text-sm leading-5 text-red-600`}>
        {message}
      </Text>

      <Pressable
        onPress={onDismiss}
        hitSlop={10}
        accessibilityLabel="Dismiss error"
      >
        <Text style={tw`ml-3 text-base font-bold text-red-400`}>
          ✕
        </Text>
      </Pressable>
    </Animated.View>
  );
}
