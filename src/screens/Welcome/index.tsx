import { View } from "react-native";
import React from "react";
import { BGView, Button } from "@/components";
import { LOCAL_IMAGES } from "@/assets";
import { Typography } from "@/utils/typography";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTrackScreenFocus } from "@/analytics";

const WelcomeScreen = () => {
  useTrackScreenFocus("welcome");
  const insets = useSafeAreaInsets();
  return (
    <BGView bgImg={LOCAL_IMAGES.BG_IMG}>
      <View className="flex-1 items-center justify-center px-5 py-6">
        <View className="gap-y-3 items-center">
          <View className="gap-y-1 items-center">
            <Typography.Heading1 className="text-primary text-center">
              {`Breakaway Connect`}
            </Typography.Heading1>
            <Typography.SubHeading1 className="text-accent">
              The home for breakaway roping
            </Typography.SubHeading1>
          </View>
          <Typography.Body1 className="text-onPrimary text-center">
            The feed, the events, the runs, the horses, the gear, and the people
            together in one place.
          </Typography.Body1>
        </View>
      </View>
      <View
        className="w-screen absolute bottom-0 px-5 py-6"
        style={{ paddingBottom: insets.bottom }}
      >
        <Button
          title="Let's Get Started"
          onPress={() => router.replace("/(auth)/login")}
        />
      </View>
    </BGView>
  );
};

export default WelcomeScreen;
