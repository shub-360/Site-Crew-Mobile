import React, { useRef } from "react";
import { Pressable, Animated, StyleProp, ViewStyle } from "react-native";

interface PressableScaleProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  className?: string;
  activeOpacity?: number;
}

/**
 * A pressable component that shrinks the wrapped content to 98% on press
 * using a smooth spring animation for premium micro-interactions.
 */
export function PressableScale({
  children,
  onPress,
  style,
  disabled,
  className,
}: PressableScaleProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 3,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={style}
      className={className}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
