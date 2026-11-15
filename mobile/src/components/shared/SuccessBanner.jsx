import { useEffect, useMemo } from 'react';
import { Animated, Easing, Text } from 'react-native';
import tw from 'twrnc';
import { CheckCircle2 } from 'lucide-react-native';

export default function AnimatedSuccessBanner({ message }) {
  const drop = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    if (!message) return;

    drop.setValue(0);

    const animation = Animated.timing(drop, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [message, drop]);

  if (!message) return null;

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        tw`flex-row items-center rounded-xl border border-green-100 bg-green-50 px-4 py-3`,
        {
          opacity: drop,
          transform: [
            { translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
          ],
        },
      ]}
    >
      <CheckCircle2 size={18} color="#16A34A" />

      <Text style={tw`ml-3 flex-1 text-sm leading-5 text-green-700`}>
        {message}
      </Text>
    </Animated.View>
  );
}
