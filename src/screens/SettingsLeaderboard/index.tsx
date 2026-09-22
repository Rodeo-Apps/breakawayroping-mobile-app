import React from "react";
import { FlatList, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { Avatar, Loader, ScreenWrapper } from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import {
  T_LEADERBOARD_ROW,
  useWeeklyLeaderboard,
} from "@/services/supabase/useWeeklyLeaderboard";

const medalColor = (rank: number) => {
  if (rank === 1) return "#f59e0b"; // gold
  if (rank === 2) return "#9ca3af"; // silver
  if (rank === 3) return "#b45309"; // bronze
  return undefined;
};

const Rank = ({ rank }: { rank: number }) => {
  const color = medalColor(rank);
  if (color) {
    return <Ionicons name="medal" size={20} color={color} />;
  }
  return (
    <Typography.SubHeading2 className="text-secondaryText w-6 text-center">
      {rank}
    </Typography.SubHeading2>
  );
};

const Row = ({
  item,
  isMe,
}: {
  item: T_LEADERBOARD_ROW;
  isMe: boolean;
}) => (
  <View
    className={`flex-row items-center gap-x-3 px-3 py-3 rounded-2xl border ${
      isMe ? "bg-primary/10 border-primary/40" : "bg-background-secondary border-border"
    }`}
  >
    <View className="w-7 items-center">
      <Rank rank={item.rank} />
    </View>
    <Avatar
      uri={item.avatar_url ?? undefined}
      name={item.name ?? "Rider"}
      className="w-9 h-9"
    />
    <Typography.Body2
      className="text-primaryText flex-1"
      textProps={{ numberOfLines: 1 }}
    >
      {item.name?.trim() || "Rider"}
      {isMe ? " (You)" : ""}
    </Typography.Body2>
    <Typography.SubHeading2 className="text-primaryText">
      {item.total_points}
    </Typography.SubHeading2>
  </View>
);

const SettingsLeaderboardScreen = () => {
  const { profile } = useAuth();
  const secondaryText = useCSSVariable("--color-secondaryText") as string;
  const { rows, myRow, loading, error } = useWeeklyLeaderboard();

  if (loading) {
    return <Loader message="Loading leaderboard..." />;
  }

  return (
    <ScreenWrapper>
      <View className="flex-1 px-5 pt-5">
        <View className="gap-y-1 mb-4">
          <Typography.Heading3 className="text-primaryText">
            This Week's Leaderboard
          </Typography.Heading3>
          <Typography.Body2 className="text-secondaryText">
            Earn points by logging runs and posting. Rankings reset every week.
          </Typography.Body2>
        </View>

        {myRow && (
          <View className="mb-4">
            <Typography.Caption1 className="text-secondaryText uppercase mb-1">
              Your standing
            </Typography.Caption1>
            <Row item={myRow} isMe />
          </View>
        )}

        {error ? (
          <Typography.Body2 className="text-secondaryText text-center mt-8">
            {error}
          </Typography.Body2>
        ) : rows.length === 0 ? (
          <View className="items-center justify-center mt-12 gap-y-2">
            <Ionicons name="trophy-outline" size={40} color={secondaryText} />
            <Typography.SubHeading2 className="text-primaryText text-center">
              No points yet this week
            </Typography.SubHeading2>
            <Typography.Body2 className="text-secondaryText text-center">
              Be the first — log a run or share a post to get on the board!
            </Typography.Body2>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.user_id}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View className="h-2" />}
            contentContainerClassName="pb-10"
            renderItem={({ item }) => (
              <Row item={item} isMe={item.user_id === profile?.id} />
            )}
          />
        )}
      </View>
    </ScreenWrapper>
  );
};

export default SettingsLeaderboardScreen;
