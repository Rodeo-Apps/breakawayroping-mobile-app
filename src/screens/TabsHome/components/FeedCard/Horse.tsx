import { ActivityIndicator, View } from "react-native";
import React, { memo } from "react";
import { useHorse } from "@/services/supabase/useHorse";
import { Typography } from "@/utils/typography";
import { useCSSVariable } from "uniwind";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const Horse = ({ id }: { id: string }) => {
  // Load Horse Details
  const { horse, loading, error } = useHorse(id);

  const primaryColor = useCSSVariable("--color-primary") as string;

  if (loading) {
    return <ActivityIndicator size={"small"} color={primaryColor} />;
  }

  if (error) {
    return (
      <View>
        <Typography.Caption1 className="text-danger">
          {error}
        </Typography.Caption1>
      </View>
    );
  }

  if (!horse) return null;

  return (
    <View className="flex-row items-center gap-x-1.5 pt-1">
      <MaterialCommunityIcons name="horse" size={16} color="#3b82f6" />
      <Typography.Caption1 className="text-blue-500">
        with {horse.name}
      </Typography.Caption1>
      {!!horse.breed && (
        <Typography.Caption1 className="text-secondaryText">
          {`• ${horse.breed}`}
        </Typography.Caption1>
      )}
    </View>
  );
};

export default memo(Horse);
