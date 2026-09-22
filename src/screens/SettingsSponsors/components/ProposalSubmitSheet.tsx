import React, { useEffect, useState } from "react";
import { View, Modal, Platform, Alert } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Button, Input, SheetFormHeader, TextArea } from "@/components";
import { Typography } from "@/utils/typography";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { T_SPONSOR_OPPORTUNITY } from "@/services/supabase/sponsorshipTypes";

type Props = {
  visible: boolean;
  opportunity: T_SPONSOR_OPPORTUNITY | null;
  onClose: () => void;
  onSubmit: (payload: {
    title: string;
    description: string;
    requestedValueDollars: number;
  }) => Promise<void>;
};

export default function ProposalSubmitSheet({
  visible,
  opportunity,
  onClose,
  onSubmit,
}: Props) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      setTitle("");
      setDescription("");
      setAmount("");
    }
  }, [visible]);

  const save = async () => {
    if (!opportunity) return;
    if (!title.trim() || !description.trim()) {
      Alert.alert("Required", "Please add a title and description.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        requestedValueDollars: parseFloat(amount) || 0,
      });
      onClose();
    } catch (e: unknown) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Could not submit proposal",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={
        Platform.OS === "ios" ? "pageSheet" : undefined
      }
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        <SheetFormHeader title="Submit proposal" onClose={onClose} />
        <KeyboardAwareScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <View className="px-5 py-6 gap-y-6">
            {opportunity ? (
              <View className="bg-background-secondary border border-border rounded-2xl p-4 gap-y-2">
                <Typography.SubHeading2 className="text-primaryText">
                  {opportunity.opportunity_title}
                </Typography.SubHeading2>
                <Typography.Body2 className="text-secondaryText">
                  {opportunity.sponsor_name}
                </Typography.Body2>
              </View>
            ) : null}

            <Input
              label="Proposal title"
              placeholder="e.g. Season sponsorship partnership"
              value={title}
              onChangeText={setTitle}
            />
            <TextArea
              label="Description"
              placeholder="Describe what you'll provide in exchange for sponsorship…"
              value={description}
              onChangeText={setDescription}
            />
            <Input
              label="Requested amount ($)"
              placeholder="5000"
              value={amount}
              onChangeText={setAmount}
              inputProps={{ keyboardType: "decimal-pad" }}
            />

            <Button
              title="Submit proposal"
              onPress={() => void save()}
              loading={submitting}
            />
          </View>
        </KeyboardAwareScrollView>
      </View>
    </Modal>
  );
}
