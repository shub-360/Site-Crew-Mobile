import React, { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import { CheckCircle2 } from "lucide-react-native";

interface ToastProps {
  visible: boolean;
  message: string;
  onHide: () => void;
  duration?: number;
}

export function Toast({ visible, message, onHide, duration = 2500 }: ToastProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Fade In
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Hide after duration
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          onHide();
        });
      }, duration);

      return () => clearTimeout(timer);
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, message, duration, fadeAnim, onHide]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [
          {
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-20, 0],
            }),
          },
        ],
      }}
      className="absolute top-14 left-6 right-6 z-50 flex-row items-center gap-3 bg-green-600 px-4 py-3.5 rounded-2xl shadow-lg border border-green-500"
    >
      <CheckCircle2 size={18} color="#FFFFFF" />
      <Text className="text-white font-bold text-sm flex-1 leading-normal">
        {message}
      </Text>
    </Animated.View>
  );
}
