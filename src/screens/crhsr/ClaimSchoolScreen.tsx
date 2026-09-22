import React, { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import {
  Button,
  EmptyState,
  Input,
  Loader,
  ScreenWrapper,
} from "@/components";
import { Typography } from "@/utils/typography";
import { useSchoolSearch } from "@/services/supabase/crhsr";
import type { SchoolRecord } from "@/services/supabase/crhsr";

type FilterKey = "all" | "college" | "high_school";

const SchoolRow = ({ school }: { school: SchoolRecord }) => {
  const primary = useCSSVariable("--color-primary") as string;
  const isCollege = school.type === "college";
  const locationParts = [school.city, school.state].filter(Boolean);
  return (
    <Pressable
      onPress={() => router.push(`/crhsr/${school.id}`)}
      className="bg-card rounded-3xl p-4 mb-3 flex-row items-center gap-x-3"
    >
      <View
        className="w-12 h-12 rounded-2xl items-center justify-center"
        style={{ backgroundColor: `${primary}22` }}
      >
        <Ionicons
          name={isCollege ? "school" : "ribbon"}
          size={24}
          color={primary}
        />
      </View>
      <View className="flex-1">
        <Typography.SubHeading2
          className="text-primaryText"
          textProps={{ numberOfLines: 1 }}
        >
          {school.name}
        </Typography.SubHeading2>
        <Typography.Body2
          className="text-secondaryText"
          textProps={{ numberOfLines: 1 }}
        >
          {isCollege ? "College" : "High school"}
          {locationParts.length ? ` · ${locationParts.join(", ")}` : ""}
        </Typography.Body2>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9f9f9f" />
    </Pressable>
  );
};

const ClaimSchoolScreen = () => {
  const primary = useCSSVariable("--color-primary") as string;
  const { schools, loading, error, reloadSchools } = useSchoolSearch();
  const [queryText, setQueryText] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [refreshing, setRefreshing] = useState(false);

  const applySearch = (nextFilter: FilterKey, nextQuery: string) => {
    void reloadSchools({
      query: nextQuery.trim() || undefined,
      type: nextFilter === "all" ? undefined : nextFilter,
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await reloadSchools();
    setRefreshing(false);
  };

  const FilterTab = ({ k, label }: { k: FilterKey; label: string }) => {
    const active = filter === k;
    return (
      <Pressable
        onPress={() => {
          setFilter(k);
          applySearch(k, queryText);
        }}
        className={`px-4 py-2 rounded-full ${active ? "bg-primary" : "bg-card"}`}
      >
        <Typography.Body2
          className={active ? "text-onPrimary" : "text-secondaryText"}
        >
          {label}
        </Typography.Body2>
      </Pressable>
    );
  };

  return (
    <ScreenWrapper>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color="#000" />
        </Pressable>
        <Typography.Heading3 className="text-primaryText">
          Schools & Teams
        </Typography.Heading3>
        <View style={{ width: 26 }} />
      </View>

      {/* Search */}
      <View className="px-5 pb-3">
        <Input
          placeholder="Search schools..."
          value={queryText}
          onChangeText={(t) => {
            setQueryText(t);
            applySearch(filter, t);
          }}
          icon={<Ionicons name="search" size={20} color="#9f9f9f" />}
        />
      </View>

      {/* Filters */}
      <View className="flex-row gap-x-2 px-5 pb-3">
        <FilterTab k="all" label="All" />
        <FilterTab k="college" label="College" />
        <FilterTab k="high_school" label="High school" />
      </View>

      {/* Create CTA */}
      <View className="px-5 pb-3">
        <Pressable
          onPress={() => router.push("/crhsr/register")}
          className="rounded-3xl p-4 flex-row items-center gap-x-3"
          style={{ backgroundColor: `${primary}14` }}
        >
          <View
            className="w-10 h-10 rounded-2xl items-center justify-center"
            style={{ backgroundColor: `${primary}22` }}
          >
            <Ionicons name="add" size={22} color={primary} />
          </View>
          <View className="flex-1">
            <Typography.SubHeading2 className="text-primaryText">
              Can't find your school?
            </Typography.SubHeading2>
            <Typography.Body2 className="text-secondaryText">
              Create its page and claim it as a coach
            </Typography.Body2>
          </View>
          <Ionicons name="chevron-forward" size={20} color={primary} />
        </Pressable>
      </View>

      {loading ? (
        <Loader message="Loading schools..." />
      ) : error ? (
        <EmptyState
          icon={<Ionicons name="warning-outline" size={40} color="#ef4444" />}
          message={error}
        />
      ) : schools.length === 0 ? (
        <View className="flex-1">
          <EmptyState
            icon={<Ionicons name="search-outline" size={48} color="#9f9f9f" />}
            message="No schools found. Try a different search, or create a new school page."
          />
          <View className="px-5">
            <Button
              title="Create a school page"
              onPress={() => router.push("/crhsr/register")}
            />
          </View>
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-5"
          contentContainerClassName="pb-10"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {schools.map((s) => (
            <SchoolRow key={s.id} school={s} />
          ))}
        </ScrollView>
      )}
    </ScreenWrapper>
  );
};

export default ClaimSchoolScreen;
