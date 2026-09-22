import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AppRefreshControl,
  FloatingRoundedIconButton,
  IconTabs,
  Input,
  ScreenWrapper,
} from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import {
  useArenaFinderList,
  type T_ARENA_LIST_ITEM,
} from "@/services/supabase/useArenaFinderList";
import { useTrackScreenFocus } from "@/analytics";
import { useCSSVariable } from "uniwind";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ArenaFormSheet from "./components/ArenaFormSheet";
import ArenaDetailSheet from "./components/ArenaDetailSheet";
import ArenaMapView from "./components/ArenaMapView";

type TypeFilter = "all" | "practice" | "competition" | "both";

type ViewMode = "list" | "map";

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "practice", label: "Practice" },
  { value: "competition", label: "Competition" },
  { value: "both", label: "Both" },
];

function matchesSearch(a: T_ARENA_LIST_ITEM, q: string) {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const blob = [a.name, a.address, a.city, a.state, a.zip]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return blob.includes(s);
}

const SettingsFindArenaScreen = () => {
  useTrackScreenFocus("settings_find_arena");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const primaryColor = useCSSVariable("--color-primary") as string;
  const mutedIcon = useCSSVariable("--color-secondaryText") as string;
  const { profile } = useAuth();
  const userId = profile?.id ?? "";

  const {
    arenas,
    loading,
    locationLoading,
    userCoords,
    loadLocation,
    refresh,
    insertArena,
    updateArena,
    deleteArena,
  } = useArenaFinderList();

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedArena, setSelectedArena] = useState<T_ARENA_LIST_ITEM | null>(
    null,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [arenaForEdit, setArenaForEdit] = useState<T_ARENA_LIST_ITEM | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const didRequestLocation = useRef(false);

  const viewTabOptions = useMemo(
    () => [
      {
        value: "list",
        renderIcon: (isActive: boolean) => (
          <Ionicons
            name="list-outline"
            size={20}
            color={isActive ? "#ffffff" : mutedIcon || "#6b7280"}
          />
        ),
      },
      {
        value: "map",
        renderIcon: (isActive: boolean) => (
          <Ionicons
            name="map-outline"
            size={20}
            color={isActive ? "#ffffff" : mutedIcon || "#6b7280"}
          />
        ),
      },
    ],
    [mutedIcon],
  );

  useEffect(() => {
    if (!userId || didRequestLocation.current) return;
    didRequestLocation.current = true;
    void loadLocation();
  }, [userId, loadLocation]);

  useFocusEffect(
    useCallback(() => {
      if (userId) void refresh();
    }, [userId, refresh]),
  );

  const filteredArenas = useMemo(() => {
    return arenas.filter((a) => {
      if (typeFilter !== "all" && a.arena_type !== typeFilter) return false;
      return matchesSearch(a, searchQuery);
    });
  }, [arenas, typeFilter, searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const openAdd = useCallback(() => {
    setFormMode("add");
    setArenaForEdit(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback(() => {
    if (!selectedArena) return;
    const a = selectedArena;
    setFormMode("edit");
    setArenaForEdit(a);
    setSelectedArena(null);
    setFormOpen(true);
  }, [selectedArena]);

  const handleSave = useCallback(
    async (payload: Record<string, unknown>) => {
      setSaving(true);
      try {
        if (formMode === "add") {
          await insertArena(payload);
        } else if (arenaForEdit) {
          await updateArena(arenaForEdit.id, payload);
        }
        await refresh();
        setFormOpen(false);
        setArenaForEdit(null);
      } catch (e: unknown) {
        Alert.alert(
          "Error",
          e instanceof Error ? e.message : "Could not save arena.",
        );
      } finally {
        setSaving(false);
      }
    },
    [formMode, arenaForEdit, insertArena, updateArena, refresh],
  );

  const handleDelete = useCallback(async () => {
    if (!selectedArena) return;
    const id = selectedArena.id;
    try {
      await deleteArena(id);
      await refresh();
      setSelectedArena(null);
    } catch (e: unknown) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Could not delete arena.",
      );
    }
  }, [selectedArena, deleteArena, refresh]);

  if (!profile?.id) {
    return (
      <ScreenWrapper>
        <View className="flex-1 px-5 pt-4 justify-center">
          <Typography.Body2 className="text-secondaryText text-center">
            Sign in to browse arenas, see distances from your location, and add
            listings.
          </Typography.Body2>
        </View>
      </ScreenWrapper>
    );
  }

  if (loading && arenas.length === 0) {
    return (
      <View className="flex-1 bg-background">
        <View className="flex-row items-center px-2 py-3 border-b border-border bg-background-secondary">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="w-10 h-10 items-center justify-center rounded-full active:opacity-70"
          >
            <Ionicons name="arrow-back" size={24} color={primaryColor} />
          </Pressable>
          <View className="flex-1 items-center justify-center">
            <Typography.Heading3 className="text-primaryText">
              Find arena
            </Typography.Heading3>
          </View>
          <View className="w-10 h-10" />
        </View>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={primaryColor} />
          <Typography.Body2 className="text-secondaryText mt-3">
            Loading arenas…
          </Typography.Body2>
        </View>
      </View>
    );
  }

  const listBody =
    filteredArenas.length === 0 ? (
      <View className="items-center py-10">
        <Ionicons name="location-outline" size={56} color="#d1d5db" />
        <Typography.SubHeading1 className="text-secondaryText mt-4 text-center">
          No arenas match
        </Typography.SubHeading1>
        <Typography.Body2 className="text-secondaryText mt-2 text-center max-w-sm">
          Try another search or filter, or add a new arena with +.
        </Typography.Body2>
      </View>
    ) : (
      <View className="gap-y-6">
        {filteredArenas.map((arena) => (
          <Pressable
            key={arena.id}
            onPress={() => setSelectedArena(arena)}
            className="bg-background-secondary border border-border rounded-2xl p-4 gap-y-2 active:opacity-90"
          >
            <View className="flex-row items-start gap-x-3">
              <View className="w-11 h-11 rounded-2xl bg-primary/15 items-center justify-center shrink-0">
                <Ionicons name="business" size={22} color={primaryColor} />
              </View>
              <View className="flex-1 min-w-0 gap-y-1">
                <Typography.Body2 className="text-primaryText font-poppins-semibold">
                  {arena.name}
                </Typography.Body2>
                <Text
                  className="text-secondaryText font-poppins text-base"
                  numberOfLines={2}
                >
                  {[arena.address, arena.city, arena.state]
                    .filter(Boolean)
                    .join(", ")}
                </Text>
                <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                  <Typography.Caption1 className="text-secondaryText capitalize">
                    {arena.arena_type}
                  </Typography.Caption1>
                  {arena.distanceLabel ? (
                    <View className="flex-row items-center gap-x-1">
                      <Ionicons name="navigate" size={12} color="#3b82f6" />
                      <Typography.Caption1 className="text-primary font-poppins-semibold">
                        {arena.distanceLabel}
                      </Typography.Caption1>
                    </View>
                  ) : null}
                  <View className="flex-row items-center gap-x-1">
                    <Ionicons name="star" size={12} color="#fbbf24" />
                    <Typography.Caption1 className="text-secondaryText">
                      {Number(arena.rating).toFixed(1)}
                    </Typography.Caption1>
                  </View>
                </View>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    );

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1 px-5 pt-6">
        <View className="gap-y-6 flex-1">
          <Typography.Body2 className="text-secondaryText">
            Browse active arenas, open details for directions and contact info,
            and add your own listing. Tap the location icon to sort by distance.
          </Typography.Body2>

          <View className="flex-row items-center gap-x-3">
            <View className="flex-1 min-w-0">
              <Input
                placeholder="Search name, city, address…"
                value={searchQuery}
                onChangeText={setSearchQuery}
                icon={
                  <Ionicons
                    name="search-outline"
                    size={20}
                    color={mutedIcon || "#9ca3af"}
                  />
                }
              />
            </View>
            <IconTabs
              options={viewTabOptions}
              selected={viewMode}
              onChange={(v) => setViewMode(v as ViewMode)}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
            style={{ flexGrow: 0 }}
          >
            {TYPE_FILTERS.map((f) => {
              const active = typeFilter === f.value;
              return (
                <Pressable
                  key={f.value}
                  onPress={() => setTypeFilter(f.value)}
                  className={`px-4 py-2 rounded-full border ${
                    active
                      ? "bg-primary border-primary"
                      : "bg-background-secondary border-border"
                  }`}
                >
                  <Typography.Caption1
                    className={
                      active
                        ? "text-white font-poppins-semibold"
                        : "text-primaryText"
                    }
                  >
                    {f.label}
                  </Typography.Caption1>
                </Pressable>
              );
            })}
          </ScrollView>

          {viewMode === "list" ? (
            <KeyboardAwareScrollView
              className="flex-1"
              contentContainerStyle={{
                flexGrow: 1,
                paddingBottom: insets.bottom + 96,
              }}
              refreshControl={
                <AppRefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                />
              }
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              showsVerticalScrollIndicator={false}
            >
              <View className="gap-y-6">{listBody}</View>
            </KeyboardAwareScrollView>
          ) : (
            <View
              className="flex-1 rounded-2xl overflow-hidden border border-border"
              style={{ marginBottom: insets.bottom + 72 }}
            >
              <ArenaMapView
                arenas={filteredArenas}
                userCoords={userCoords}
                onMarkerPress={setSelectedArena}
              />
            </View>
          )}
        </View>
      </View>

      <FloatingRoundedIconButton
        icon={<Ionicons name="add" size={28} color="#fff" />}
        onPress={openAdd}
        accessibilityLabel="Add arena listing"
      />

      <ArenaDetailSheet
        open={!!selectedArena}
        arena={selectedArena}
        isOwner={
          !!selectedArena?.owner_id &&
          String(selectedArena.owner_id) === String(userId)
        }
        onClose={() => setSelectedArena(null)}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <ArenaFormSheet
        visible={formOpen}
        mode={formMode}
        arena={arenaForEdit}
        saving={saving}
        userId={userId}
        onClose={() => {
          setFormOpen(false);
          setArenaForEdit(null);
        }}
        onSave={handleSave}
      />
    </View>
  );
};

export default SettingsFindArenaScreen;
