import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { AppRefreshControl } from "@/components";
import Button from "@/components/ui/Button";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { Typography } from "@/utils/typography";
import { useCSSVariable } from "uniwind";

interface Horse {
  id: string;
  name: string;
  breed?: string;
  age?: number;
}

interface HealthRecord {
  id: string;
  record_type: string;
  visit_date: string;
  veterinarian_name?: string;
  diagnosis?: string;
  treatment_plan?: string;
  status: string;
  notes?: string;
}

interface Medication {
  id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  start_date: string;
  end_date?: string;
  is_active: boolean;
}

interface RecoveryMetric {
  id: string;
  metric_date: string;
  recovery_stage?: string;
  stress_level?: number;
  activity_level?: string;
  temperature?: number;
  heart_rate?: number;
  notes?: string;
}

type HealthDashboardContentProps = {
  compactHeader?: boolean;
};

export default function HealthDashboardContent({
  compactHeader = false,
}: HealthDashboardContentProps) {
  const primaryColor = useCSSVariable("--color-primary") as string;
  const accentColor = useCSSVariable("--color-accent") as string;
  const secondaryTextColor = useCSSVariable("--color-secondaryText") as string;

  const [selectedTab, setSelectedTab] = useState<
    "records" | "medications" | "recovery" | "wearable"
  >("records");
  const [horses, setHorses] = useState<Horse[]>([]);
  const [selectedHorse, setSelectedHorse] = useState<string | null>(null);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [recoveryMetrics, setRecoveryMetrics] = useState<RecoveryMetric[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const isMissingTableError = (error: unknown) =>
    (error as { code?: string })?.code === "PGRST205";

  useEffect(() => {
    loadHorses();
  }, []);

  useEffect(() => {
    if (selectedHorse) {
      loadHealthData();
    }
  }, [selectedHorse, selectedTab]);

  const loadHorses = async () => {
    try {
      const { data, error } = await supabase
        .from("horses")
        .select("id, name, breed, age")
        .order("name");

      if (error) throw error;
      if (data && data.length > 0) {
        setHorses(data);
        setSelectedHorse(data[0].id);
      }
    } catch (error) {
      console.error("Error loading horses:", error);
    }
  };

  const loadHealthData = async () => {
    if (!selectedHorse) return;

    setLoading(true);
    try {
      if (selectedTab === "records") {
        const primary = await supabase
          .from("horse_health_records")
          .select("*")
          .eq("horse_id", selectedHorse)
          .order("visit_date", { ascending: false });

        if (!primary.error) {
          setHealthRecords(primary.data || []);
        } else if (isMissingTableError(primary.error)) {
          const fallback = await supabase
            .from("vet_visits")
            .select("*")
            .eq("horse_id", selectedHorse)
            .order("visit_date", { ascending: false });
          if (!fallback.error) {
            const mapped: HealthRecord[] = (fallback.data || []).map(
              (row: Record<string, unknown>) => ({
                id: row.id as string,
                record_type: "vet_visit",
                visit_date: row.visit_date as string,
                veterinarian_name:
                  (row.vet_name as string) ||
                  (row.veterinarian_name as string) ||
                  undefined,
                diagnosis: (row.diagnosis as string) || undefined,
                treatment_plan:
                  (row.treatment as string) ||
                  (row.treatment_plan as string) ||
                  undefined,
                status: (row.status as string) || "open",
                notes: (row.notes as string) || undefined,
              }),
            );
            setHealthRecords(mapped);
          } else if (isMissingTableError(fallback.error)) {
            setHealthRecords([]);
          } else {
            throw fallback.error;
          }
        } else {
          throw primary.error;
        }
      } else if (selectedTab === "medications") {
        const primary = await supabase
          .from("medication_schedules")
          .select("*")
          .eq("horse_id", selectedHorse)
          .order("start_date", { ascending: false });

        if (!primary.error) {
          setMedications(primary.data || []);
        } else if (isMissingTableError(primary.error)) {
          const fallback = await supabase
            .from("vaccinations")
            .select("*")
            .eq("horse_id", selectedHorse)
            .order("date_administered", { ascending: false });
          if (!fallback.error) {
            const mapped: Medication[] = (fallback.data || []).map(
              (row: Record<string, unknown>) => ({
                id: row.id as string,
                medication_name: (row.vaccine_name as string) || "Vaccination",
                dosage: (row.dose as string) || "As prescribed",
                frequency: (row.frequency as string) || "Per schedule",
                start_date: row.date_administered as string,
                end_date: (row.next_due_date as string) || null,
                is_active:
                  !row.next_due_date ||
                  new Date(row.next_due_date as string).getTime() > Date.now(),
              }),
            );
            setMedications(mapped);
          } else if (isMissingTableError(fallback.error)) {
            setMedications([]);
          } else {
            throw fallback.error;
          }
        } else {
          throw primary.error;
        }
      } else if (selectedTab === "recovery") {
        const primary = await supabase
          .from("recovery_metrics")
          .select("*")
          .eq("horse_id", selectedHorse)
          .order("metric_date", { ascending: false })
          .limit(30);

        if (!primary.error) {
          setRecoveryMetrics(primary.data || []);
        } else if (isMissingTableError(primary.error)) {
          setRecoveryMetrics([]);
        } else {
          throw primary.error;
        }
      }
    } catch (error: unknown) {
      if (isMissingTableError(error)) {
        setHealthRecords([]);
        setMedications([]);
        setRecoveryMetrics([]);
        return;
      }
      console.error("Error loading health data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRecordTypeIcon = (type: string) => {
    switch (type) {
      case "vet_visit":
        return "medical";
      case "injury":
        return "bandage";
      case "illness":
        return "thermometer";
      case "routine_checkup":
        return "clipboard";
      case "emergency":
        return "warning";
      default:
        return "document-text";
    }
  };

  const getRecordTypeColor = (type: string) => {
    switch (type) {
      case "vet_visit":
        return primaryColor;
      case "injury":
        return "#ef4444";
      case "illness":
        return "#f59e0b";
      case "routine_checkup":
        return "#10b981";
      case "emergency":
        return "#dc2626";
      default:
        return secondaryTextColor;
    }
  };

  const getActivityLevelColor = (level?: string) => {
    switch (level) {
      case "rest":
        return "#dc2626";
      case "light_walk":
        return "#f59e0b";
      case "walk":
        return "#fbbf24";
      case "trot":
        return "#84cc16";
      case "light_work":
        return "#22c55e";
      case "moderate_work":
        return "#10b981";
      case "full_work":
        return "#14b8a6";
      default:
        return secondaryTextColor;
    }
  };

  const handleOpenAddMenu = () => {
    if (!selectedHorse) {
      Alert.alert("No horse selected", "Please select a horse first.");
      return;
    }
    setShowAddMenu(true);
  };

  const handleAddItem = (type: "records" | "medications" | "recovery") => {
    setShowAddMenu(false);
    setSelectedTab(type);
    Alert.alert(
      "Add entry",
      "Inline creation for this section is coming soon. For now, use existing data sync/entry workflows.",
      [{ text: "OK" }],
    );
  };

  const tabClass = (active: boolean) =>
    `flex-1 flex-row items-center justify-center py-4 gap-1.5 border-b-2 ${
      active ? "border-primary" : "border-transparent"
    }`;

  const tabLabelClass = (active: boolean) =>
    `text-sm font-poppins-medium ${active ? "text-primary" : "text-secondaryText"}`;

  return (
    <View className="flex-1 bg-background relative">
      <View className="flex-row items-center justify-between border-b border-border px-5 py-5 bg-background">
        {compactHeader ? (
          <View className="flex-row items-center flex-1 gap-3 mr-2">
            <MaterialCommunityIcons name="heart-pulse" size={26} color={accentColor} />
            <Typography.Body2 className="flex-1 text-secondaryText">
              Track records, medications, and recovery metrics by horse.
            </Typography.Body2>
          </View>
        ) : (
          <Typography.Heading3 className="text-primaryText">
            Health Dashboard
          </Typography.Heading3>
        )}
        <Pressable
          onPress={handleOpenAddMenu}
          className="p-1"
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Add health entry"
        >
          <Ionicons name="add-circle" size={28} color={primaryColor} />
        </Pressable>
      </View>

      {horses.length === 0 ? (
        <View className="flex-1 justify-center items-center px-10">
          <MaterialCommunityIcons
            name="horse"
            size={64}
            color={secondaryTextColor}
          />
          <Typography.SubHeading1 className="text-secondaryText mt-4">
            No horses added yet
          </Typography.SubHeading1>
          <Typography.Body2 className="text-secondaryText mt-2 text-center">
            Add a horse to start tracking health data
          </Typography.Body2>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="border-b border-border py-3 px-4 bg-background"
          >
            {horses.map((horse) => {
              const selected = selectedHorse === horse.id;
              return (
                <Pressable
                  key={horse.id}
                  className={`min-w-[100px] items-center rounded-xl border-2 p-3 mr-3 ${
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-transparent bg-card-secondary"
                  }`}
                  onPress={() => setSelectedHorse(horse.id)}
                >
                  <MaterialCommunityIcons
                    name="horse"
                    size={24}
                    color={selected ? primaryColor : secondaryTextColor}
                  />
                  <Typography.SubHeading2
                    className={
                      selected ? "text-primary mt-1.5" : "text-secondaryText mt-1.5"
                    }
                  >
                    {horse.name}
                  </Typography.SubHeading2>
                  {horse.breed ? (
                    <Typography.Caption1 className="text-placeholderText mt-0.5">
                      {horse.breed}
                    </Typography.Caption1>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <View className="flex-row border-b border-border bg-background">
            <Pressable
              className={tabClass(selectedTab === "records")}
              onPress={() => setSelectedTab("records")}
            >
              <Ionicons
                name="clipboard"
                size={20}
                color={selectedTab === "records" ? primaryColor : secondaryTextColor}
              />
              <Typography.Body2 className={tabLabelClass(selectedTab === "records")}>
                Records
              </Typography.Body2>
            </Pressable>

            <Pressable
              className={tabClass(selectedTab === "medications")}
              onPress={() => setSelectedTab("medications")}
            >
              <Ionicons
                name="medical"
                size={20}
                color={
                  selectedTab === "medications" ? primaryColor : secondaryTextColor
                }
              />
              <Typography.Body2
                className={tabLabelClass(selectedTab === "medications")}
              >
                Meds
              </Typography.Body2>
            </Pressable>

            <Pressable
              className={tabClass(selectedTab === "recovery")}
              onPress={() => setSelectedTab("recovery")}
            >
              <Ionicons
                name="trending-up"
                size={20}
                color={selectedTab === "recovery" ? primaryColor : secondaryTextColor}
              />
              <Typography.Body2 className={tabLabelClass(selectedTab === "recovery")}>
                Recovery
              </Typography.Body2>
            </Pressable>

            <Pressable
              className={tabClass(selectedTab === "wearable")}
              onPress={() => setSelectedTab("wearable")}
            >
              <Ionicons
                name="watch"
                size={20}
                color={selectedTab === "wearable" ? primaryColor : secondaryTextColor}
              />
              <Typography.Body2 className={tabLabelClass(selectedTab === "wearable")}>
                Wearable
              </Typography.Body2>
            </Pressable>
          </View>

          <ScrollView
            className="flex-1 p-4"
            refreshControl={
              <AppRefreshControl refreshing={loading} onRefresh={loadHealthData} />
            }
          >
            {selectedTab === "records" && (
              <View>
                {healthRecords.length === 0 ? (
                  <Typography.Body2 className="text-secondaryText text-center py-10 italic">
                    No health records yet
                  </Typography.Body2>
                ) : (
                  healthRecords.map((record) => (
                    <View
                      key={record.id}
                      className="bg-card border border-border rounded-xl p-4 mb-3"
                    >
                      <View className="flex-row items-center mb-3">
                        <Ionicons
                          name={getRecordTypeIcon(record.record_type) as React.ComponentProps<typeof Ionicons>["name"]}
                          size={24}
                          color={getRecordTypeColor(record.record_type)}
                        />
                        <View className="flex-1 ml-3">
                          <Typography.SubHeading2 className="text-primaryText">
                            {record.record_type.replace("_", " ").toUpperCase()}
                          </Typography.SubHeading2>
                          <Typography.Body2 className="text-secondaryText mt-0.5">
                            {new Date(record.visit_date).toLocaleDateString()}
                          </Typography.Body2>
                        </View>
                        <View
                          className={`px-2.5 py-1 rounded-xl ${
                            record.status === "resolved"
                              ? "bg-success/15"
                              : "bg-warning/15"
                          }`}
                        >
                          <Typography.Caption1
                            className={`font-poppins-semibold capitalize ${
                              record.status === "resolved"
                                ? "text-success"
                                : "text-warning"
                            }`}
                          >
                            {record.status}
                          </Typography.Caption1>
                        </View>
                      </View>
                      {record.veterinarian_name ? (
                        <Typography.Body2 className="text-primaryText mb-1">
                          Vet: {record.veterinarian_name}
                        </Typography.Body2>
                      ) : null}
                      {record.diagnosis ? (
                        <Typography.Body2 className="text-primaryText mb-1">
                          Diagnosis: {record.diagnosis}
                        </Typography.Body2>
                      ) : null}
                      {record.notes ? (
                        <Typography.Body2 className="text-secondaryText mt-2 italic">
                          {record.notes}
                        </Typography.Body2>
                      ) : null}
                    </View>
                  ))
                )}
              </View>
            )}

            {selectedTab === "medications" && (
              <View>
                {medications.length === 0 ? (
                  <Typography.Body2 className="text-secondaryText text-center py-10 italic">
                    No medications scheduled
                  </Typography.Body2>
                ) : (
                  medications.map((med) => (
                    <View
                      key={med.id}
                      className="bg-card border border-border rounded-xl p-4 mb-3"
                    >
                      <View className="flex-row items-center mb-3">
                        <Ionicons name="medical" size={24} color={primaryColor} />
                        <View className="flex-1 ml-3">
                          <Typography.SubHeading2 className="text-primaryText">
                            {med.medication_name}
                          </Typography.SubHeading2>
                          <Typography.Body2 className="text-secondaryText mt-0.5">
                            {med.dosage}
                          </Typography.Body2>
                        </View>
                        {med.is_active ? (
                          <View className="bg-success/15 px-2.5 py-1 rounded-xl">
                            <Typography.Caption1 className="text-success font-poppins-semibold">
                              Active
                            </Typography.Caption1>
                          </View>
                        ) : null}
                      </View>
                      <Typography.Body2 className="text-primaryText mb-1">
                        Frequency: {med.frequency}
                      </Typography.Body2>
                      <Typography.Body2 className="text-primaryText mb-1">
                        Started: {new Date(med.start_date).toLocaleDateString()}
                      </Typography.Body2>
                      {med.end_date ? (
                        <Typography.Body2 className="text-primaryText mb-1">
                          Ends: {new Date(med.end_date).toLocaleDateString()}
                        </Typography.Body2>
                      ) : null}
                    </View>
                  ))
                )}
              </View>
            )}

            {selectedTab === "recovery" && (
              <View>
                {recoveryMetrics.length === 0 ? (
                  <Typography.Body2 className="text-secondaryText text-center py-10 italic">
                    No recovery metrics tracked
                  </Typography.Body2>
                ) : (
                  recoveryMetrics.map((metric) => (
                    <View
                      key={metric.id}
                      className="bg-card border border-border rounded-xl p-4 mb-3"
                    >
                      <View className="flex-row items-center mb-3">
                        <Ionicons name="trending-up" size={24} color="#10b981" />
                        <View className="flex-1 ml-3">
                          <Typography.SubHeading2 className="text-primaryText">
                            {new Date(metric.metric_date).toLocaleDateString()}
                          </Typography.SubHeading2>
                          {metric.recovery_stage ? (
                            <Typography.Body2 className="text-secondaryText mt-0.5">
                              {metric.recovery_stage}
                            </Typography.Body2>
                          ) : null}
                        </View>
                      </View>
                      <View className="flex-row flex-wrap gap-3">
                        {metric.stress_level != null ? (
                          <View className="flex-1 min-w-[45%]">
                            <Typography.Caption1 className="text-secondaryText mb-1">
                              Stress
                            </Typography.Caption1>
                            <Typography.SubHeading2 className="text-primaryText">
                              {metric.stress_level}/10
                            </Typography.SubHeading2>
                          </View>
                        ) : null}
                        {metric.activity_level ? (
                          <View className="flex-1 min-w-[45%]">
                            <Typography.Caption1 className="text-secondaryText mb-1">
                              Activity
                            </Typography.Caption1>
                            <View
                              className="self-start px-2 py-1 rounded-lg"
                              style={{
                                backgroundColor: getActivityLevelColor(
                                  metric.activity_level,
                                ),
                              }}
                            >
                              <Typography.Caption1 className="text-white font-poppins-semibold capitalize">
                                {metric.activity_level.replace("_", " ")}
                              </Typography.Caption1>
                            </View>
                          </View>
                        ) : null}
                        {metric.temperature != null ? (
                          <View className="flex-1 min-w-[45%]">
                            <Typography.Caption1 className="text-secondaryText mb-1">
                              Temp
                            </Typography.Caption1>
                            <Typography.SubHeading2 className="text-primaryText">
                              {metric.temperature}°F
                            </Typography.SubHeading2>
                          </View>
                        ) : null}
                        {metric.heart_rate != null ? (
                          <View className="flex-1 min-w-[45%]">
                            <Typography.Caption1 className="text-secondaryText mb-1">
                              Heart Rate
                            </Typography.Caption1>
                            <Typography.SubHeading2 className="text-primaryText">
                              {metric.heart_rate} bpm
                            </Typography.SubHeading2>
                          </View>
                        ) : null}
                      </View>
                      {metric.notes ? (
                        <Typography.Body2 className="text-secondaryText mt-2 italic">
                          {metric.notes}
                        </Typography.Body2>
                      ) : null}
                    </View>
                  ))
                )}
              </View>
            )}

            {selectedTab === "wearable" && (
              <View className="flex-1 justify-center items-center px-10 py-10">
                <Ionicons name="watch" size={64} color={secondaryTextColor} />
                <Typography.SubHeading1 className="text-primaryText mt-4">
                  Wearable Integration
                </Typography.SubHeading1>
                <Typography.Body2 className="text-secondaryText mt-2 text-center leading-5">
                  Connect your horse&apos;s wearable device to track real-time health
                  metrics. Coming soon!
                </Typography.Body2>
              </View>
            )}
          </ScrollView>
        </>
      )}

      {showAddMenu ? (
        <View className="absolute inset-0 z-50 justify-center items-center px-6">
          <Pressable
            className="absolute inset-0 bg-black/45"
            onPress={() => setShowAddMenu(false)}
            accessibilityLabel="Dismiss"
          />
          <View className="w-full max-w-md rounded-2xl border border-border bg-background p-5 z-10">
            <Typography.SubHeading1 className="text-primaryText">
              Add Health Entry
            </Typography.SubHeading1>
            <Typography.Body2 className="text-secondaryText mt-1.5 mb-4">
              Choose what you want to add
            </Typography.Body2>

            <Pressable
              className="flex-row items-center gap-2 py-3 border-b border-border"
              onPress={() => handleAddItem("records")}
            >
              <Ionicons name="clipboard" size={18} color={primaryColor} />
              <Typography.SubHeading2 className="text-primaryText">
                Health Record
              </Typography.SubHeading2>
            </Pressable>

            <Pressable
              className="flex-row items-center gap-2 py-3 border-b border-border"
              onPress={() => handleAddItem("medications")}
            >
              <Ionicons name="medical" size={18} color={primaryColor} />
              <Typography.SubHeading2 className="text-primaryText">
                Medication
              </Typography.SubHeading2>
            </Pressable>

            <Pressable
              className="flex-row items-center gap-2 py-3 border-b border-border"
              onPress={() => handleAddItem("recovery")}
            >
              <Ionicons name="trending-up" size={18} color={primaryColor} />
              <Typography.SubHeading2 className="text-primaryText">
                Recovery Metric
              </Typography.SubHeading2>
            </Pressable>

            <View className="mt-4">
              <Button
                title="Cancel"
                variant="outlined"
                onPress={() => setShowAddMenu(false)}
              />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
