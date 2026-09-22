import React from "react";
import { View } from "react-native";
import { ScreenWrapper } from "@/components";
import { Typography } from "@/utils/typography";

type T_SETTINGS_FEATURE_TEMPLATE_PROPS = {
  title: string;
  description?: string;
};

const SettingsFeatureTemplate = ({
  title,
  description = "This section will be available soon.",
}: T_SETTINGS_FEATURE_TEMPLATE_PROPS) => {
  return (
    <ScreenWrapper>
      <View className="flex-1 items-center justify-center px-6 gap-y-2">
        <Typography.Heading3 className="text-primaryText text-center">
          {title}
        </Typography.Heading3>
        <Typography.Body2 className="text-secondaryText text-center">
          {description}
        </Typography.Body2>
      </View>
    </ScreenWrapper>
  );
};

export default SettingsFeatureTemplate;
