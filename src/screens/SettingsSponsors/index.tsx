import React, { useCallback, useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AppRefreshControl,
  Button,
  EmptyState,
  ScreenWrapper,
  ScrollableTabs,
  StatMetricCard,
} from "@/components";
import { Typography } from "@/utils/typography";
import { useAuth } from "@/provider/AuthProvider";
import { useSponsorshipHub } from "@/services/supabase/useSponsorshipHub";
import type {
  T_SPONSOR_OPPORTUNITY,
  T_SPONSORSHIP_CONTRACT,
  T_SPONSORSHIP_DELIVERABLE,
  T_SPONSORSHIP_PROPOSAL,
} from "@/services/supabase/sponsorshipTypes";
import { useTrackScreenFocus } from "@/analytics";
import { useCSSVariable } from "uniwind";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ProposalSubmitSheet from "./components/ProposalSubmitSheet";

const SPONSORSHIP_TABS = [
  { value: "dashboard", label: "Dashboard", icon: "stats-chart" as const },
  { value: "contracts", label: "Contracts", icon: "document-text" as const },
  {
    value: "deliverables",
    label: "Deliverables",
    icon: "checkmark-done" as const,
  },
  { value: "opportunities", label: "Find sponsors", icon: "search" as const },
  { value: "proposals", label: "Proposals", icon: "paper-plane" as const },
] as const;

type TabValue = (typeof SPONSORSHIP_TABS)[number]["value"];

function formatCurrency(cents: number) {
  return `$${(cents / 100).toLocaleString()}`;
}

function statusHex(status: string) {
  switch (status) {
    case "active":
      return "#10b981";
    case "pending":
      return "#f59e0b";
    case "expired":
      return "#6b7280";
    case "completed":
      return "#3b82f6";
    case "overdue":
      return "#ef4444";
    case "accepted":
      return "#10b981";
    case "declined":
      return "#ef4444";
    default:
      return "#9ca3af";
  }
}

function deliverableIcon(
  type: string,
): React.ComponentProps<typeof Ionicons>["name"] {
  switch (type) {
    case "social_post":
      return "logo-instagram";
    case "logo_placement":
      return "image";
    case "event_appearance":
      return "calendar";
    case "content_creation":
      return "videocam";
    case "product_usage":
      return "cube";
    default:
      return "checkmark-circle";
  }
}

const SettingsSponsorsScreen = () => {
  useTrackScreenFocus("sponsorship");
  const insets = useSafeAreaInsets();
  const primaryColor = useCSSVariable("--color-primary") as string;
  const successColor = useCSSVariable("--color-success") as string;
  const { profile } = useAuth();

  const {
    contracts,
    deliverables,
    opportunities,
    proposals,
    loading,
    dashboardStats,
    refresh,
    submitProposal,
  } = useSponsorshipHub(profile?.id);

  const [activeTab, setActiveTab] = useState<TabValue>("dashboard");
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] =
    useState<T_SPONSOR_OPPORTUNITY | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (profile?.id) void refresh();
    }, [profile?.id, refresh]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const onContractPress = (contract: T_SPONSORSHIP_CONTRACT) => {
    Alert.alert(
      contract.sponsor_name,
      `${formatCurrency(contract.contract_value_cents)} · ${contract.status}\n\nOpen Marketplace → Sponsorship Hub for full contract details.`,
    );
  };

  const filteredDeliverables = filterStatus
    ? deliverables.filter((d) => d.status === filterStatus)
    : deliverables;

  const filteredOpportunities = opportunities.filter(
    (opp) =>
      !searchQuery.trim() ||
      opp.sponsor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opp.opportunity_title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleProposalSubmit = async (payload: {
    title: string;
    description: string;
    requestedValueDollars: number;
  }) => {
    if (!selectedOpportunity) return;
    await submitProposal({
      opportunity: selectedOpportunity,
      title: payload.title,
      description: payload.description,
      requestedValueDollars: payload.requestedValueDollars,
    });
    Alert.alert("Success", "Proposal submitted successfully!");
  };

  if (!profile?.id) {
    return (
      <ScreenWrapper>
        <View className="flex-1 px-5 pt-4 justify-center">
          <Typography.Body2 className="text-secondaryText text-center">
            Sign in to view sponsorship contracts, deliverables, and
            opportunities.
          </Typography.Body2>
        </View>
      </ScreenWrapper>
    );
  }

  if (loading && contracts.length === 0 && opportunities.length === 0) {
    return (
      <View className="flex-1 bg-background justify-center items-center px-5">
        <ActivityIndicator size="large" color={primaryColor} />
        <Typography.Body2 className="text-secondaryText mt-3">
          Loading sponsorship…
        </Typography.Body2>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Typography.Body2 className="text-secondaryText px-5 pt-4 pb-2">
        Track contracts, deliverables, and apply to sponsor opportunities.
      </Typography.Body2>

      <ScrollableTabs
        options={[...SPONSORSHIP_TABS]}
        selected={activeTab}
        onChange={(v) => setActiveTab(v as TabValue)}
      />

      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerClassName="px-5 py-6 gap-y-6"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "dashboard" ? (
          <DashboardPanel
            dashboardStats={dashboardStats}
            contracts={contracts}
            primaryColor={primaryColor}
            successColor={successColor}
            onContractPress={onContractPress}
            onFindSponsors={() => setActiveTab("opportunities")}
          />
        ) : null}

        {activeTab === "contracts" ? (
          <ContractsPanel contracts={contracts} onPress={onContractPress} />
        ) : null}

        {activeTab === "deliverables" ? (
          <DeliverablesPanel
            deliverables={filteredDeliverables}
            filterStatus={filterStatus}
            onFilterChange={setFilterStatus}
            primaryColor={primaryColor}
          />
        ) : null}

        {activeTab === "opportunities" ? (
          <OpportunitiesPanel
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            opportunities={filteredOpportunities}
            onApply={(opp) => {
              setSelectedOpportunity(opp);
              setProposalOpen(true);
            }}
          />
        ) : null}

        {activeTab === "proposals" ? (
          <ProposalsPanel proposals={proposals} />
        ) : null}
      </KeyboardAwareScrollView>

      <ProposalSubmitSheet
        visible={proposalOpen}
        opportunity={selectedOpportunity}
        onClose={() => {
          setProposalOpen(false);
          setSelectedOpportunity(null);
        }}
        onSubmit={handleProposalSubmit}
      />
    </View>
  );
};

function DashboardPanel({
  dashboardStats,
  contracts,
  primaryColor,
  successColor,
  onContractPress,
  onFindSponsors,
}: {
  dashboardStats: {
    activeContracts: number;
    totalValue: number;
    upcomingDeliverables: number;
    pendingProposals: number;
  };
  contracts: T_SPONSORSHIP_CONTRACT[];
  primaryColor: string;
  successColor: string;
  onContractPress: (c: T_SPONSORSHIP_CONTRACT) => void;
  onFindSponsors: () => void;
}) {
  return (
    <View className="gap-y-6">
      <View className="flex-row flex-wrap gap-x-3 gap-y-3">
        <StatMetricCard
          icon="ribbon"
          iconColor={primaryColor}
          value={String(dashboardStats.activeContracts)}
          label="Active sponsors"
        />
        <StatMetricCard
          icon="cash"
          iconColor={successColor}
          value={formatCurrency(dashboardStats.totalValue)}
          label="Total value"
        />
      </View>
      <View className="flex-row flex-wrap gap-x-3 gap-y-3">
        <StatMetricCard
          icon="time"
          iconColor="#f59e0b"
          value={String(dashboardStats.upcomingDeliverables)}
          label="Due soon"
        />
        <StatMetricCard
          icon="document-text"
          iconColor="#3b82f6"
          value={String(dashboardStats.pendingProposals)}
          label="Pending proposals"
        />
      </View>

      <View className="gap-y-3">
        <Typography.SubHeading2 className="text-primaryText">
          Recent activity
        </Typography.SubHeading2>
        {contracts.slice(0, 3).map((contract) => (
          <Pressable
            key={contract.id}
            onPress={() => onContractPress(contract)}
            className="flex-row items-center gap-x-3 bg-background border border-border rounded-2xl p-4 active:opacity-90"
          >
            <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center">
              <Ionicons name="business" size={24} color={primaryColor} />
            </View>
            <View className="flex-1 min-w-0 gap-y-1">
              <Typography.Body2 className="text-primaryText font-poppins-semibold">
                {contract.sponsor_name}
              </Typography.Body2>
              <Typography.Caption1 className="text-secondaryText">
                {formatCurrency(contract.contract_value_cents)} · {contract.status}
              </Typography.Caption1>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </Pressable>
        ))}
      </View>

      <Button title="Find new sponsors" onPress={onFindSponsors} />
    </View>
  );
}

function ContractsPanel({
  contracts,
  onPress,
}: {
  contracts: T_SPONSORSHIP_CONTRACT[];
  onPress: (c: T_SPONSORSHIP_CONTRACT) => void;
}) {
  if (contracts.length === 0) {
    return (
      <EmptyState
        icon={<Ionicons name="ribbon-outline" size={56} color="#d1d5db" />}
        message="No sponsorship contracts yet. Browse opportunities to get started."
      />
    );
  }
  return (
    <View className="gap-y-3">
      {contracts.map((contract) => (
        <Pressable
          key={contract.id}
          onPress={() => onPress(contract)}
          className="bg-background border border-border rounded-2xl p-4 gap-y-3 active:opacity-90"
        >
          <View className="flex-row items-start gap-x-3">
            <View className="w-14 h-14 rounded-xl bg-primary/10 items-center justify-center">
              <Ionicons name="business" size={28} color="#8b5cf6" />
            </View>
            <View className="flex-1 min-w-0 gap-y-1">
              <Typography.Body2 className="text-primaryText font-poppins-semibold">
                {contract.sponsor_name}
              </Typography.Body2>
              {contract.sponsor_industry ? (
                <Typography.Caption1 className="text-secondaryText">
                  {contract.sponsor_industry}
                </Typography.Caption1>
              ) : null}
            </View>
            <View
              className="px-2 py-1 rounded-lg self-start"
              style={{ backgroundColor: statusHex(contract.status) }}
            >
              <Typography.Caption1 className="text-white font-poppins-bold uppercase">
                {contract.status}
              </Typography.Caption1>
            </View>
          </View>
          <View className="gap-y-2">
            <View className="flex-row items-center gap-x-3">
              <Ionicons name="cash" size={16} color="#10b981" />
              <Typography.Body2 className="text-secondaryText">
                {formatCurrency(contract.contract_value_cents)}
              </Typography.Body2>
            </View>
            <View className="flex-row items-center gap-x-3">
              <Ionicons name="calendar" size={16} color="#6b7280" />
              <Typography.Caption1 className="text-secondaryText">
                {new Date(contract.contract_start_date).toLocaleDateString()} –{" "}
                {new Date(contract.contract_end_date).toLocaleDateString()}
              </Typography.Caption1>
            </View>
            <View className="flex-row items-center gap-x-3">
              <Ionicons name="repeat" size={16} color="#6b7280" />
              <Typography.Caption1 className="text-secondaryText capitalize">
                {contract.payment_schedule.replace(/_/g, " ")}
              </Typography.Caption1>
            </View>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function DeliverablesPanel({
  deliverables,
  filterStatus,
  onFilterChange,
  primaryColor,
}: {
  deliverables: T_SPONSORSHIP_DELIVERABLE[];
  filterStatus: string | null;
  onFilterChange: (s: string | null) => void;
  primaryColor: string;
}) {
  const filters = ["all", "pending", "completed", "overdue"] as const;
  return (
    <View className="gap-y-4">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-x-2"
      >
        {filters.map((status) => {
          const active =
            status === "all" ? filterStatus === null : filterStatus === status;
          return (
            <Pressable
              key={status}
              onPress={() =>
                onFilterChange(status === "all" ? null : status)
              }
              className={`px-4 py-2 rounded-full border ${
                active
                  ? "bg-primary border-primary"
                  : "bg-background-secondary border-border"
              }`}
            >
              <Typography.Caption1
                className={
                  active
                    ? "text-onPrimary font-poppins-semibold capitalize"
                    : "text-secondaryText capitalize"
                }
              >
                {status}
              </Typography.Caption1>
            </Pressable>
          );
        })}
      </ScrollView>

      {deliverables.length === 0 ? (
        <EmptyState
          icon={
            <Ionicons name="checkmark-done-outline" size={56} color="#d1d5db" />
          }
          message="No deliverables match this filter."
        />
      ) : (
        <View className="gap-y-3">
          {deliverables.map((d) => (
            <View
              key={d.id}
              className="bg-background border border-border rounded-2xl p-4 gap-y-3"
            >
              <View className="flex-row items-start gap-x-3">
                <View className="w-11 h-11 rounded-full bg-primary/10 items-center justify-center">
                  <Ionicons
                    name={deliverableIcon(d.deliverable_type)}
                    size={22}
                    color={primaryColor}
                  />
                </View>
                <View className="flex-1 min-w-0 gap-y-1">
                  <Typography.Body2 className="text-primaryText font-poppins-semibold">
                    {d.deliverable_name}
                  </Typography.Body2>
                  <Typography.Caption1 className="text-secondaryText">
                    {d.contract?.sponsor_name}
                  </Typography.Caption1>
                </View>
                <View
                  className="px-2 py-1 rounded-lg self-start"
                  style={{ backgroundColor: statusHex(d.status) }}
                >
                  <Typography.Caption1 className="text-white font-poppins-bold uppercase text-[10px]">
                    {d.status}
                  </Typography.Caption1>
                </View>
              </View>
              <View className="flex-row items-center gap-x-3">
                <Ionicons name="calendar" size={14} color="#6b7280" />
                <Typography.Caption1 className="text-secondaryText">
                  Due {new Date(d.due_date).toLocaleDateString()}
                </Typography.Caption1>
              </View>
              {d.quantity_required > 1 ? (
                <Typography.Caption1 className="text-secondaryText">
                  {d.quantity_completed}/{d.quantity_required} completed
                </Typography.Caption1>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function OpportunitiesPanel({
  searchQuery,
  onSearchChange,
  opportunities,
  onApply,
}: {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  opportunities: T_SPONSOR_OPPORTUNITY[];
  onApply: (opp: T_SPONSOR_OPPORTUNITY) => void;
}) {
  return (
    <View className="gap-y-4">
      <View className="flex-row items-center gap-x-3 bg-background-secondary rounded-full px-4 h-14 border border-border">
        <Ionicons name="search" size={20} color="#9ca3af" />
        <TextInput
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder="Search opportunities…"
          placeholderTextColor="#9ca3af"
          className={`flex-1 text-base text-primaryText ${searchQuery ? "font-poppins-medium" : ""}`}
        />
      </View>

      {opportunities.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="search-outline" size={56} color="#d1d5db" />}
          message="No opportunities match your search."
        />
      ) : (
        <View className="gap-y-3">
          {opportunities.map((opp) => (
            <View
              key={opp.id}
              className="bg-background border border-border rounded-2xl p-4 gap-y-3"
            >
              <View className="flex-row items-start gap-x-3">
                <View className="w-11 h-11 rounded-full bg-amber-500/15 items-center justify-center">
                  <Ionicons name="star" size={22} color="#fbbf24" />
                </View>
                <View className="flex-1 min-w-0 gap-y-1">
                  <Typography.Body2 className="text-primaryText font-poppins-semibold">
                    {opp.opportunity_title}
                  </Typography.Body2>
                  <Typography.Caption1 className="text-secondaryText">
                    {opp.sponsor_name}
                  </Typography.Caption1>
                  {opp.sponsor_industry ? (
                    <View className="self-start bg-background-secondary px-2 py-1 rounded-lg mt-1">
                      <Typography.Caption1 className="text-secondaryText">
                        {opp.sponsor_industry}
                      </Typography.Caption1>
                    </View>
                  ) : null}
                </View>
              </View>
              {opp.description ? (
                <Typography.Body2
                  className="text-secondaryText"
                  textProps={{ numberOfLines: 3 }}
                >
                  {opp.description}
                </Typography.Body2>
              ) : null}
              <View className="flex-row items-center gap-x-2">
                <Ionicons name="cash" size={18} color="#10b981" />
                <Typography.Body2 className="text-primaryText font-poppins-semibold">
                  {formatCurrency(opp.value_range_min_cents)} –{" "}
                  {formatCurrency(opp.value_range_max_cents)}
                </Typography.Body2>
              </View>
              {opp.requirements?.length ? (
                <View className="gap-y-1">
                  <Typography.Caption1 className="text-primaryText font-poppins-semibold">
                    Requirements
                  </Typography.Caption1>
                  {opp.requirements.slice(0, 2).map((req, i) => (
                    <Typography.Caption1
                      key={`${opp.id}-req-${i}`}
                      className="text-secondaryText"
                    >
                      • {req}
                    </Typography.Caption1>
                  ))}
                </View>
              ) : null}
              <Button title="Apply" onPress={() => onApply(opp)} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function ProposalsPanel({ proposals }: { proposals: T_SPONSORSHIP_PROPOSAL[] }) {
  if (proposals.length === 0) {
    return (
      <EmptyState
        icon={
          <Ionicons name="document-text-outline" size={56} color="#d1d5db" />
        }
        message="No proposals yet. Apply to an opportunity to get started."
      />
    );
  }
  return (
    <View className="gap-y-3">
      {proposals.map((p) => (
        <View
          key={p.id}
          className="bg-background border border-border rounded-2xl p-4 gap-y-3"
        >
          <View className="flex-row items-start justify-between gap-x-3">
            <View className="flex-1 min-w-0 gap-y-1">
              <Typography.Body2 className="text-primaryText font-poppins-semibold">
                {p.proposal_title}
              </Typography.Body2>
              <Typography.Caption1 className="text-secondaryText">
                {p.sponsor_name}
              </Typography.Caption1>
            </View>
            <View
              className="px-2 py-1 rounded-lg shrink-0"
              style={{ backgroundColor: statusHex(p.status) }}
            >
              <Typography.Caption1 className="text-white font-poppins-bold uppercase text-[10px]">
                {p.status}
              </Typography.Caption1>
            </View>
          </View>
          <View className="flex-row items-center gap-x-3">
            <Ionicons name="cash" size={16} color="#10b981" />
            <Typography.Body2 className="text-secondaryText">
              {formatCurrency(p.requested_value_cents)}
            </Typography.Body2>
          </View>
          <View className="flex-row items-center gap-x-3">
            <Ionicons name="calendar" size={16} color="#6b7280" />
            <Typography.Caption1 className="text-secondaryText">
              Submitted {new Date(p.submitted_at).toLocaleDateString()}
            </Typography.Caption1>
          </View>
          {p.responded_at ? (
            <View className="flex-row items-center gap-x-3">
              <Ionicons name="checkmark-circle" size={16} color="#3b82f6" />
              <Typography.Caption1 className="text-secondaryText">
                Responded {new Date(p.responded_at).toLocaleDateString()}
              </Typography.Caption1>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export default SettingsSponsorsScreen;
