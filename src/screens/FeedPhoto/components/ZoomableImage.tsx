import React from "react";
import { Image, type ImageProps, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  clamp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

type T_ZOOMABLE_IMAGE_PROPS = Pick<
  ImageProps,
  "source" | "onLoadStart" | "onLoadEnd" | "onError"
>;

const ZoomableImage: React.FC<T_ZOOMABLE_IMAGE_PROPS> = ({
  source,
  onLoadStart,
  onLoadEnd,
  onError,
}) => {
  const scale = useSharedValue(1);
  const pinchStartScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onStart(() => {
      pinchStartScale.value = scale.value;
    })
    .onUpdate((e) => {
      const next = pinchStartScale.value * e.scale;
      scale.value = clamp(next, MIN_SCALE, MAX_SCALE);
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE + 0.02) {
        scale.value = withTiming(MIN_SCALE);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
      }
    });

  const pan = Gesture.Pan()
    .onStart(() => {
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
    })
    .onUpdate((e) => {
      if (scale.value > MIN_SCALE) {
        translateX.value = panStartX.value + e.translationX;
        translateY.value = panStartY.value + e.translationY;
      }
    })
    .onEnd(() => {
      if (scale.value <= MIN_SCALE) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={styles.root} pointerEvents="box-none">
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.flexFill, animatedStyle]}>
          <Image
            source={source}
            style={styles.image}
            resizeMode="contain"
            onLoadStart={onLoadStart}
            onLoadEnd={onLoadEnd}
            onError={onError}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flexFill: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});

export default ZoomableImage;
