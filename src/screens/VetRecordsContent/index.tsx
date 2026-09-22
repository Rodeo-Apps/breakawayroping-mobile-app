import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  ActivityIndicator,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { Button, Input, TextArea, SheetFormHeader } from "@/components";
import DatePicker from "@/components/ui/DatePicker";
import { useAuth } from "@/provider/AuthProvider";
import { supabase } from "@/lib/supabase";
import { Typography } from "@/utils/typography";
import { useCSSVariable } from "uniwind";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function VetBottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <View className="absolute inset-0 z-100 justify-end">
      <Pressable
        className="absolute inset-0 bg-black/50"
        onPress={onClose}
        accessibilityLabel="Dismiss"
      />
      <View className="w-full max-h-[90%] rounded-t-3xl border-t border-border bg-background overflow-hidden">
        <SheetFormHeader title={title} onClose={onClose} />
        {children}
      </View>
    </View>
  );
}

interface Horse {
  id: string;
  name: string;
  photo_url?: string;
}

interface VetContact {
  id: string;
  name: string;
  clinic_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  specialty?: string;
  notes?: string;
  is_primary: boolean;
}

interface VetVisit {
  id: string;
  visit_date: string;
  reason: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  cost?: number;
  follow_up_date?: string;
  vet_contact_id?: string;
  vet_contacts?: VetContact;
}

interface Vaccination {
  id: string;
  vaccine_name: string;
  vaccine_type?: string;
  date_administered: string;
  next_due_date: string;
  lot_number?: string;
  notes?: string;
  reminder_enabled: boolean;
  vet_contact_id?: string;
  vet_contacts?: VetContact;
}

interface VetDocument {
  id: string;
  document_type: string;
  document_name: string;
  document_url?: string;
  issue_date: string;
  expiration_date?: string;
  issuing_vet?: string;
  notes?: string;
  reminder_enabled: boolean;
}

type VetRecordsContentProps = {
  /** When true, shows a slim intro row for Settings routes that already have a stack header. */
  compactHeader?: boolean;
};

export default function VetRecordsContent({
  compactHeader = false,
}: VetRecordsContentProps) {
  const primaryColor = useCSSVariable("--color-primary") as string;
  const secondaryTextColor = useCSSVariable("--color-secondaryText") as string;
  const accentColor = useCSSVariable("--color-accent") as string;
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [horses, setHorses] = useState<Horse[]>([]);
  const [selectedHorse, setSelectedHorse] = useState<Horse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHorseSelector, setShowHorseSelector] = useState(false);

  const [vetVisits, setVetVisits] = useState<VetVisit[]>([]);
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [documents, setDocuments] = useState<VetDocument[]>([]);
  const [vetContacts, setVetContacts] = useState<VetContact[]>([]);

  const [showAddVisit, setShowAddVisit] = useState(false);
  const [showAddVaccination, setShowAddVaccination] = useState(false);
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [showAddVet, setShowAddVet] = useState(false);

  const [newVisit, setNewVisit] = useState({
    visit_date: new Date().toISOString().split('T')[0],
    reason: '',
    diagnosis: '',
    treatment: '',
    notes: '',
    cost: '',
    vet_contact_id: '',
  });

  const [newVaccination, setNewVaccination] = useState({
    vaccine_name: '',
    vaccine_type: 'Core',
    date_administered: new Date().toISOString().split('T')[0],
    next_due_date: '',
    lot_number: '',
    notes: '',
    vet_contact_id: '',
  });

  const [newDocument, setNewDocument] = useState({
    document_type: 'coggins',
    document_name: '',
    issue_date: new Date().toISOString().split('T')[0],
    expiration_date: '',
    issuing_vet: '',
    notes: '',
  });

  const [newVet, setNewVet] = useState({
    name: '',
    clinic_name: '',
    phone: '',
    email: '',
    address: '',
    specialty: '',
    notes: '',
    is_primary: false,
  });

  useEffect(() => {
    loadHorses();
  }, []);

  useEffect(() => {
    if (selectedHorse) {
      loadVetRecords();
    }
  }, [selectedHorse]);

  const loadHorses = async () => {
    try {
      const { data, error } = await supabase
        .from('horses')
        .select('id, name, photo_url')
        .eq('user_id', profile?.id)
        .order('name');

      if (error) throw error;

      setHorses(data || []);
      if (data && data.length > 0 && !selectedHorse) {
        setSelectedHorse(data[0]);
      }
    } catch (error) {
      console.error('Error loading horses:', error);
    }
  };

  const loadVetRecords = async () => {
    if (!selectedHorse) return;

    setLoading(true);
    try {
      const [visitsRes, vaccinationsRes, documentsRes, contactsRes] = await Promise.all([
        supabase
          .from('vet_visits')
          .select('*, vet_contacts(*)')
          .eq('horse_id', selectedHorse.id)
          .order('visit_date', { ascending: false }),
        supabase
          .from('vaccinations')
          .select('*, vet_contacts(*)')
          .eq('horse_id', selectedHorse.id)
          .order('next_due_date', { ascending: true }),
        supabase
          .from('vet_documents')
          .select('*')
          .eq('horse_id', selectedHorse.id)
          .order('issue_date', { ascending: false }),
        supabase
          .from('vet_contacts')
          .select('*')
          .eq('user_id', profile?.id)
          .order('is_primary', { ascending: false }),
      ]);

      if (visitsRes.data) setVetVisits(visitsRes.data);
      if (vaccinationsRes.data) setVaccinations(vaccinationsRes.data);
      if (documentsRes.data) setDocuments(documentsRes.data);
      if (contactsRes.data) setVetContacts(contactsRes.data);
    } catch (error) {
      console.error('Error loading vet records:', error);
    } finally {
      setLoading(false);
    }
  };

  const addVetVisit = async () => {
    if (!selectedHorse || !newVisit.reason) {
      Alert.alert('Error', 'Please fill in required fields');
      return;
    }

    try {
      const { error } = await supabase.from('vet_visits').insert({
        horse_id: selectedHorse.id,
        user_id: profile?.id,
        ...newVisit,
        cost: newVisit.cost ? parseFloat(newVisit.cost) : null,
        vet_contact_id: newVisit.vet_contact_id || null,
      });

      if (error) throw error;

      Alert.alert('Success', 'Vet visit added');
      setShowAddVisit(false);
      setNewVisit({
        visit_date: new Date().toISOString().split('T')[0],
        reason: '',
        diagnosis: '',
        treatment: '',
        notes: '',
        cost: '',
        vet_contact_id: '',
      });
      loadVetRecords();
    } catch (error: any) {
      console.error('Error adding vet visit:', error);
      Alert.alert('Error', 'Failed to add vet visit');
    }
  };

  const addVaccination = async () => {
    if (!selectedHorse || !newVaccination.vaccine_name || !newVaccination.next_due_date) {
      Alert.alert('Error', 'Please fill in required fields');
      return;
    }

    try {
      const { error } = await supabase.from('vaccinations').insert({
        horse_id: selectedHorse.id,
        user_id: profile?.id,
        ...newVaccination,
        vet_contact_id: newVaccination.vet_contact_id || null,
      });

      if (error) throw error;

      Alert.alert('Success', 'Vaccination added');
      setShowAddVaccination(false);
      setNewVaccination({
        vaccine_name: '',
        vaccine_type: 'Core',
        date_administered: new Date().toISOString().split('T')[0],
        next_due_date: '',
        lot_number: '',
        notes: '',
        vet_contact_id: '',
      });
      loadVetRecords();
    } catch (error: any) {
      console.error('Error adding vaccination:', error);
      Alert.alert('Error', 'Failed to add vaccination');
    }
  };

  const addDocument = async () => {
    if (!selectedHorse || !newDocument.document_name) {
      Alert.alert('Error', 'Please fill in required fields');
      return;
    }

    try {
      const { error } = await supabase.from('vet_documents').insert({
        horse_id: selectedHorse.id,
        user_id: profile?.id,
        ...newDocument,
        expiration_date: newDocument.expiration_date || null,
      });

      if (error) throw error;

      Alert.alert('Success', 'Document added');
      setShowAddDocument(false);
      setNewDocument({
        document_type: 'coggins',
        document_name: '',
        issue_date: new Date().toISOString().split('T')[0],
        expiration_date: '',
        issuing_vet: '',
        notes: '',
      });
      loadVetRecords();
    } catch (error: any) {
      console.error('Error adding document:', error);
      Alert.alert('Error', 'Failed to add document');
    }
  };

  const addVetContact = async () => {
    if (!newVet.name) {
      Alert.alert('Error', 'Please enter veterinarian name');
      return;
    }

    try {
      const { error } = await supabase.from('vet_contacts').insert({
        user_id: profile?.id,
        ...newVet,
      });

      if (error) throw error;

      Alert.alert('Success', 'Veterinarian added');
      setShowAddVet(false);
      setNewVet({
        name: '',
        clinic_name: '',
        phone: '',
        email: '',
        address: '',
        specialty: '',
        notes: '',
        is_primary: false,
      });
      loadVetRecords();
    } catch (error: any) {
      console.error('Error adding vet contact:', error);
      Alert.alert('Error', 'Failed to add veterinarian');
    }
  };

  const getVaccinationStatus = () => {
    if (vaccinations.length === 0) return { status: 'unknown', color: '#9ca3af' };

    const today = new Date();
    const overdue = vaccinations.filter(
      (v) => new Date(v.next_due_date) < today
    );
    const dueSoon = vaccinations.filter((v) => {
      const dueDate = new Date(v.next_due_date);
      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysUntilDue > 0 && daysUntilDue <= 30;
    });

    if (overdue.length > 0) {
      return { status: `${overdue.length} Overdue`, color: '#ef4444' };
    }
    if (dueSoon.length > 0) {
      return { status: `${dueSoon.length} Due Soon`, color: '#f59e0b' };
    }
    return { status: 'Up to Date', color: '#10b981' };
  };

  const getDocumentStatusColor = (doc: VetDocument) => {
    if (!doc.expiration_date) return '#6b7280';

    const today = new Date();
    const expirationDate = new Date(doc.expiration_date);
    const daysUntilExpiration = Math.ceil(
      (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiration < 0) return '#ef4444';
    if (daysUntilExpiration <= 30) return '#f59e0b';
    return '#10b981';
  };

  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const vaccStatus = getVaccinationStatus();

  const OverviewCard = () => (
    <View className="bg-card border border-border rounded-xl mx-4 mt-4 p-5">
      <Typography.Heading3 className="text-primaryText mb-4">Overview</Typography.Heading3>
      <View className="flex-row flex-wrap gap-3">
        <View className="flex-1 min-w-[45%] bg-card-secondary rounded-xl p-4 items-center gap-2">
          <Ionicons name="calendar" size={24} color={primaryColor} />
          <Typography.Caption1 className="text-secondaryText text-center">Last Visit</Typography.Caption1>
          <Typography.Body2 className="text-primaryText text-center font-poppins-semibold">
            {vetVisits.length > 0
              ? new Date(vetVisits[0].visit_date).toLocaleDateString()
              : "No visits"}
          </Typography.Body2>
        </View>
        <View className="flex-1 min-w-[45%] bg-card-secondary rounded-xl p-4 items-center gap-2">
          <Ionicons name="medical" size={24} color={vaccStatus.color} />
          <Typography.Caption1 className="text-secondaryText text-center">Vaccinations</Typography.Caption1>
          <Typography.Body2
            className="text-center font-poppins-semibold"
            textProps={{ style: { color: vaccStatus.color } }}
          >
            {vaccStatus.status}
          </Typography.Body2>
        </View>
        <View className="flex-1 min-w-[45%] bg-card-secondary rounded-xl p-4 items-center gap-2">
          <Ionicons name="document-text" size={24} color={primaryColor} />
          <Typography.Caption1 className="text-secondaryText text-center">Documents</Typography.Caption1>
          <Typography.Body2 className="text-primaryText text-center font-poppins-semibold">
            {documents.length} on file
          </Typography.Body2>
        </View>
        <View className="flex-1 min-w-[45%] bg-card-secondary rounded-xl p-4 items-center gap-2">
          <Ionicons name="people" size={24} color={primaryColor} />
          <Typography.Caption1 className="text-secondaryText text-center">Vets</Typography.Caption1>
          <Typography.Body2 className="text-primaryText text-center font-poppins-semibold">
            {vetContacts.length} contacts
          </Typography.Body2>
        </View>
      </View>
    </View>
  );

  const VaccinationsCard = () => (
    <View className="bg-card border border-border rounded-xl mx-4 mt-4 p-5">
      <View className="flex-row justify-between items-center mb-4">
        <Typography.Heading3 className="text-primaryText">Vaccinations</Typography.Heading3>
        <Pressable
          onPress={() => setShowAddVaccination(true)}
          className="p-1"
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Add vaccination"
        >
          <Ionicons name="add-circle" size={28} color={primaryColor} />
        </Pressable>
      </View>
      {vaccinations.length === 0 ? (
        <Typography.Body2 className="text-secondaryText italic text-center py-5">
          No vaccination records
        </Typography.Body2>
      ) : (
        vaccinations.map((vacc) => {
          const daysUntil = getDaysUntilDue(vacc.next_due_date);
          const isOverdue = daysUntil < 0;
          const isDueSoon = daysUntil >= 0 && daysUntil <= 30;
          const statusColor = isOverdue
            ? "#ef4444"
            : isDueSoon
              ? "#f59e0b"
              : "#10b981";

          return (
            <View
              key={vacc.id}
              className="bg-card-secondary rounded-xl p-4 mb-3"
            >
              <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1 mr-3">
                  <Typography.SubHeading2 className="text-primaryText mb-1">
                    {vacc.vaccine_name}
                  </Typography.SubHeading2>
                  {vacc.vaccine_type ? (
                    <Typography.Body2 className="text-secondaryText">{vacc.vaccine_type}</Typography.Body2>
                  ) : null}
                </View>
                <View
                  className="px-3 py-1.5 rounded-xl"
                  style={{ backgroundColor: `${statusColor}26` }}
                >
                  <Typography.Body2
                    className="text-xs font-poppins-semibold"
                    textProps={{ style: { color: statusColor } }}
                  >
                    {isOverdue ? "Overdue" : isDueSoon ? "Due Soon" : "Current"}
                  </Typography.Body2>
                </View>
              </View>
              <View className="gap-1.5 mt-2">
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="calendar" size={14} color={secondaryTextColor} />
                  <Typography.Body2 className="text-secondaryText flex-1">
                    Given: {new Date(vacc.date_administered).toLocaleDateString()}
                  </Typography.Body2>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="time" size={14} color={secondaryTextColor} />
                  <Typography.Body2 className="text-secondaryText flex-1">
                    Due: {new Date(vacc.next_due_date).toLocaleDateString()}
                    {Math.abs(daysUntil) <= 60 ? (
                      <Text style={{ color: statusColor }}>
                        {" "}
                        ({Math.abs(daysUntil)} days{isOverdue ? " ago" : ""})
                      </Text>
                    ) : null}
                  </Typography.Body2>
                </View>
                {vacc.vet_contacts ? (
                  <View className="flex-row items-center gap-1.5">
                    <Ionicons name="person" size={14} color={secondaryTextColor} />
                    <Typography.Body2 className="text-secondaryText flex-1">
                      Dr. {vacc.vet_contacts.name}
                    </Typography.Body2>
                  </View>
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </View>
  );

  const VetVisitsCard = () => (
    <View className="bg-card border border-border rounded-xl mx-4 mt-4 p-5">
      <View className="flex-row justify-between items-center mb-4">
        <Typography.Heading3 className="text-primaryText">Vet Visits</Typography.Heading3>
        <Pressable
          onPress={() => setShowAddVisit(true)}
          className="p-1"
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Add vet visit"
        >
          <Ionicons name="add-circle" size={28} color={primaryColor} />
        </Pressable>
      </View>
      {vetVisits.length === 0 ? (
        <Typography.Body2 className="text-secondaryText italic text-center py-5">
          No vet visits recorded
        </Typography.Body2>
      ) : (
        vetVisits.map((visit) => (
          <View key={visit.id} className="bg-card-secondary rounded-xl p-4 mb-3">
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1 mr-3">
                <Typography.SubHeading2 className="text-primaryText mb-1">
                  {visit.reason}
                </Typography.SubHeading2>
                <Typography.Body2 className="text-secondaryText">
                  {new Date(visit.visit_date).toLocaleDateString()}
                </Typography.Body2>
              </View>
              {visit.cost ? (
                <Typography.SubHeading1 className="text-primary">
                  ${visit.cost.toFixed(2)}
                </Typography.SubHeading1>
              ) : null}
            </View>
            {visit.diagnosis ? (
              <Typography.Body2 className="text-primaryText mb-2">{visit.diagnosis}</Typography.Body2>
            ) : null}
            {visit.vet_contacts ? (
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="person" size={14} color={secondaryTextColor} />
                <Typography.Body2 className="text-secondaryText flex-1">
                  Dr. {visit.vet_contacts.name}
                  {visit.vet_contacts.clinic_name
                    ? ` - ${visit.vet_contacts.clinic_name}`
                    : ""}
                </Typography.Body2>
              </View>
            ) : null}
          </View>
        ))
      )}
    </View>
  );

  const DocumentsCard = () => (
    <View className="bg-card border border-border rounded-xl mx-4 mt-4 p-5">
      <View className="flex-row justify-between items-center mb-4">
        <Typography.Heading3 className="text-primaryText">Documents</Typography.Heading3>
        <Pressable
          onPress={() => setShowAddDocument(true)}
          className="p-1"
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Add document"
        >
          <Ionicons name="add-circle" size={28} color={primaryColor} />
        </Pressable>
      </View>
      {documents.length === 0 ? (
        <Typography.Body2 className="text-secondaryText italic text-center py-5">
          No documents on file
        </Typography.Body2>
      ) : (
        documents.map((doc) => {
          const statusColor = getDocumentStatusColor(doc);
          return (
            <View key={doc.id} className="bg-card-secondary rounded-xl p-4 mb-3">
              <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1 mr-3">
                  <Typography.SubHeading2 className="text-primaryText mb-1">
                    {doc.document_name}
                  </Typography.SubHeading2>
                  <Typography.Body2 className="text-secondaryText">
                    {doc.document_type.replace("_", " ").toUpperCase()}
                  </Typography.Body2>
                </View>
                <Ionicons name="document-attach" size={24} color={statusColor} />
              </View>
              <View className="gap-1.5 mt-2">
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="calendar" size={14} color={secondaryTextColor} />
                  <Typography.Body2 className="text-secondaryText flex-1">
                    Issued: {new Date(doc.issue_date).toLocaleDateString()}
                  </Typography.Body2>
                </View>
                {doc.expiration_date ? (
                  <View className="flex-row items-center gap-1.5">
                    <Ionicons name="time" size={14} color={statusColor} />
                    <Typography.Body2
                      className="flex-1"
                      textProps={{ style: { color: statusColor } }}
                    >
                      Expires: {new Date(doc.expiration_date).toLocaleDateString()}
                    </Typography.Body2>
                  </View>
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </View>
  );

  const VetContactsCard = () => (
    <View className="bg-card border border-border rounded-xl mx-4 mt-4 mb-8 p-5">
      <View className="flex-row justify-between items-center mb-4">
        <Typography.Heading3 className="text-primaryText">Veterinarian Contacts</Typography.Heading3>
        <Pressable
          onPress={() => setShowAddVet(true)}
          className="p-1"
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Add veterinarian"
        >
          <Ionicons name="add-circle" size={28} color={primaryColor} />
        </Pressable>
      </View>
      {vetContacts.length === 0 ? (
        <Typography.Body2 className="text-secondaryText italic text-center py-5">
          No veterinarians saved
        </Typography.Body2>
      ) : (
        vetContacts.map((vet) => (
          <View key={vet.id} className="bg-card-secondary rounded-xl p-4 mb-3">
            <View className="mb-2">
              <View className="flex-row items-center gap-2 mb-1 flex-wrap">
                <Typography.SubHeading2 className="text-primaryText">
                  Dr. {vet.name}
                </Typography.SubHeading2>
                {vet.is_primary ? (
                  <View className="bg-primary/15 px-2 py-1 rounded-lg">
                    <Typography.Body2 className="text-xs text-primary font-poppins-semibold">
                      Primary
                    </Typography.Body2>
                  </View>
                ) : null}
              </View>
              {vet.clinic_name ? (
                <Typography.Body2 className="text-secondaryText">{vet.clinic_name}</Typography.Body2>
              ) : null}
              {vet.specialty ? (
                <Typography.Body2 className="text-primary mt-0.5">{vet.specialty}</Typography.Body2>
              ) : null}
            </View>
            <View className="gap-2 mt-3">
              {vet.phone ? (
                <Pressable
                  className="flex-row items-center gap-2 py-2"
                  onPress={() => Linking.openURL(`tel:${vet.phone}`)}
                >
                  <Ionicons name="call" size={20} color={primaryColor} />
                  <Typography.Body2 className="text-primary font-poppins-medium">{vet.phone}</Typography.Body2>
                </Pressable>
              ) : null}
              {vet.email ? (
                <Pressable
                  className="flex-row items-center gap-2 py-2"
                  onPress={() => Linking.openURL(`mailto:${vet.email}`)}
                >
                  <Ionicons name="mail" size={20} color={primaryColor} />
                  <Typography.Body2 className="text-primary font-poppins-medium">{vet.email}</Typography.Body2>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-background relative">
      {compactHeader ? (
        <View className="flex-row items-center gap-3 px-5 pt-4 pb-2 bg-background-secondary border-b border-border">
          <Ionicons name="heart" size={26} color={accentColor} />
          <Typography.Body2 className="flex-1 text-secondaryText">
            Vet visits, vaccinations, documents, and contacts for your horses.
          </Typography.Body2>
        </View>
      ) : null}
      <View className="bg-background-secondary border-b border-border p-4">
        <Pressable
          className="border border-border rounded-xl p-4"
          onPress={() => setShowHorseSelector(true)}
        >
          <View className="flex-row items-center gap-3">
            <Ionicons name="chevron-down" size={24} color={primaryColor} />
            <View>
              <Typography.Caption1 className="text-secondaryText mb-0.5">
                Selected Horse
              </Typography.Caption1>
              <Typography.SubHeading1 className="text-primaryText">
                {selectedHorse?.name || "Select a horse"}
              </Typography.SubHeading1>
            </View>
          </View>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center p-10">
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <ScrollView className="flex-1">
          {selectedHorse ? (
            <>
              <OverviewCard />
              <VaccinationsCard />
              <VetVisitsCard />
              <DocumentsCard />
              <VetContactsCard />
            </>
          ) : (
            <View className="flex-1 justify-center items-center p-10">
              <Ionicons name="file-tray" size={64} color="#d1d5db" />
              <Typography.SubHeading1 className="text-secondaryText mt-4 mb-2">
                No Horse Selected
              </Typography.SubHeading1>
              <Typography.Body1 className="text-secondaryText text-center">
                Select a horse to view their veterinary records
              </Typography.Body1>
            </View>
          )}
        </ScrollView>
      )}

      <VetBottomSheet
        open={showHorseSelector}
        onClose={() => setShowHorseSelector(false)}
        title="Select Horse"
      >
        <ScrollView
          className="max-h-[360px]"
          contentContainerStyle={{ paddingBottom: insets.bottom + 12 }}
        >
          {horses.map((horse) => {
            const selected = selectedHorse?.id === horse.id;
            return (
              <Pressable
                key={horse.id}
                className={`flex-row justify-between items-center px-4 py-4 border-b border-border ${
                  selected ? "bg-primary/10" : ""
                }`}
                onPress={() => {
                  setSelectedHorse(horse);
                  setShowHorseSelector(false);
                }}
              >
                <Typography.SubHeading2 className="text-primaryText">{horse.name}</Typography.SubHeading2>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={24} color={primaryColor} />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </VetBottomSheet>

      <VetBottomSheet
        open={showAddVaccination}
        onClose={() => setShowAddVaccination(false)}
        title="Add Vaccination"
      >
            <KeyboardAwareScrollView
              className="p-5"
              contentContainerClassName="gap-y-4 pb-8"
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
            >
              <Input
                label="Vaccine Name *"
                placeholder="e.g., West Nile Virus"
                value={newVaccination.vaccine_name}
                onChangeText={(text) =>
                  setNewVaccination({ ...newVaccination, vaccine_name: text })
                }
                inputProps={{ autoCapitalize: "words" }}
              />

              <DatePicker
                label="Date Administered *"
                placeholder="Select date"
                value={newVaccination.date_administered}
                onChangeValue={(text) =>
                  setNewVaccination({
                    ...newVaccination,
                    date_administered: text,
                  })
                }
                maximumDate={new Date()}
              />

              <DatePicker
                label="Next Due Date *"
                placeholder="Select due date"
                value={newVaccination.next_due_date}
                onChangeValue={(text) =>
                  setNewVaccination({ ...newVaccination, next_due_date: text })
                }
              />

              <Input
                label="Lot Number"
                placeholder="Optional"
                value={newVaccination.lot_number}
                onChangeText={(text) =>
                  setNewVaccination({ ...newVaccination, lot_number: text })
                }
              />

              <TextArea
                label="Notes"
                placeholder="Optional notes"
                value={newVaccination.notes}
                onChangeText={(text) =>
                  setNewVaccination({ ...newVaccination, notes: text })
                }
              />

              <Button title="Add Vaccination" onPress={addVaccination} />
            </KeyboardAwareScrollView>
      </VetBottomSheet>

      <VetBottomSheet
        open={showAddVisit}
        onClose={() => setShowAddVisit(false)}
        title="Add Vet Visit"
      >
            <KeyboardAwareScrollView
              className="p-5"
              contentContainerClassName="gap-y-4 pb-8"
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
            >
              <DatePicker
                label="Visit Date *"
                placeholder="Select visit date"
                value={newVisit.visit_date}
                onChangeValue={(text) =>
                  setNewVisit({ ...newVisit, visit_date: text })
                }
                maximumDate={new Date()}
              />

              <Input
                label="Reason for Visit *"
                placeholder="e.g., Annual checkup"
                value={newVisit.reason}
                onChangeText={(text) =>
                  setNewVisit({ ...newVisit, reason: text })
                }
                inputProps={{ autoCapitalize: "sentences" }}
              />

              <Input
                label="Diagnosis"
                placeholder="Optional"
                value={newVisit.diagnosis}
                onChangeText={(text) =>
                  setNewVisit({ ...newVisit, diagnosis: text })
                }
                inputProps={{ autoCapitalize: "sentences" }}
              />

              <TextArea
                label="Treatment"
                placeholder="Optional"
                value={newVisit.treatment}
                onChangeText={(text) =>
                  setNewVisit({ ...newVisit, treatment: text })
                }
              />

              <Input
                label="Cost"
                placeholder="0.00"
                value={newVisit.cost}
                onChangeText={(text) => setNewVisit({ ...newVisit, cost: text })}
                inputProps={{ keyboardType: "decimal-pad" }}
              />

              <TextArea
                label="Notes"
                placeholder="Optional notes"
                value={newVisit.notes}
                onChangeText={(text) =>
                  setNewVisit({ ...newVisit, notes: text })
                }
              />

              <Button title="Add Visit" onPress={addVetVisit} />
            </KeyboardAwareScrollView>
      </VetBottomSheet>

      <VetBottomSheet
        open={showAddDocument}
        onClose={() => setShowAddDocument(false)}
        title="Add Document"
      >
            <KeyboardAwareScrollView
              className="p-5"
              contentContainerClassName="gap-y-4 pb-8"
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
            >
              <View className="gap-y-2">
                <Typography.SubHeading2 className="text-primaryText">
                  Document Type *
                </Typography.SubHeading2>
                <View className="flex-row flex-wrap gap-2">
                  {[
                    "coggins",
                    "health_certificate",
                    "xray",
                    "lab_result",
                    "other",
                  ].map((type) => {
                    const active = newDocument.document_type === type;
                    return (
                      <Pressable
                        key={type}
                        className={`px-3 py-2 rounded-lg border ${
                          active
                            ? "bg-primary border-primary"
                            : "bg-card border-border"
                        }`}
                        onPress={() =>
                          setNewDocument({ ...newDocument, document_type: type })
                        }
                      >
                        <Typography.Body2
                          className={`text-xs font-poppins-medium uppercase ${
                            active ? "text-onPrimary" : "text-secondaryText"
                          }`}
                        >
                          {type.replace("_", " ").toUpperCase()}
                        </Typography.Body2>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Input
                label="Document Name *"
                placeholder="e.g., 2024 Coggins Test"
                value={newDocument.document_name}
                onChangeText={(text) =>
                  setNewDocument({ ...newDocument, document_name: text })
                }
              />

              <DatePicker
                label="Issue Date *"
                placeholder="Select issue date"
                value={newDocument.issue_date}
                onChangeValue={(text) =>
                  setNewDocument({ ...newDocument, issue_date: text })
                }
                maximumDate={new Date()}
              />

              <DatePicker
                label="Expiration Date"
                placeholder="Select expiration (optional)"
                value={newDocument.expiration_date}
                onChangeValue={(text) =>
                  setNewDocument({ ...newDocument, expiration_date: text })
                }
              />

              <Input
                label="Issuing Veterinarian"
                placeholder="Optional"
                value={newDocument.issuing_vet}
                onChangeText={(text) =>
                  setNewDocument({ ...newDocument, issuing_vet: text })
                }
                inputProps={{ autoCapitalize: "words" }}
              />

              <Button title="Add Document" onPress={addDocument} />
            </KeyboardAwareScrollView>
      </VetBottomSheet>

      <VetBottomSheet
        open={showAddVet}
        onClose={() => setShowAddVet(false)}
        title="Add Veterinarian"
      >
            <KeyboardAwareScrollView
              className="p-5"
              contentContainerClassName="gap-y-4 pb-8"
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
            >
              <Input
                label="Veterinarian Name *"
                placeholder="e.g., Jane Smith"
                value={newVet.name}
                onChangeText={(text) => setNewVet({ ...newVet, name: text })}
                inputProps={{ autoCapitalize: "words" }}
              />

              <Input
                label="Clinic Name"
                placeholder="e.g., Equine Medical Center"
                value={newVet.clinic_name}
                onChangeText={(text) =>
                  setNewVet({ ...newVet, clinic_name: text })
                }
              />

              <Input
                label="Phone"
                placeholder="(555) 123-4567"
                value={newVet.phone}
                onChangeText={(text) => setNewVet({ ...newVet, phone: text })}
                inputProps={{ keyboardType: "phone-pad" }}
              />

              <Input
                label="Email"
                placeholder="vet@example.com"
                value={newVet.email}
                onChangeText={(text) => setNewVet({ ...newVet, email: text })}
                inputProps={{
                  keyboardType: "email-address",
                  autoCapitalize: "none",
                }}
              />

              <Input
                label="Specialty"
                placeholder="e.g., Equine Sports Medicine"
                value={newVet.specialty}
                onChangeText={(text) =>
                  setNewVet({ ...newVet, specialty: text })
                }
              />

              <Button title="Add Veterinarian" onPress={addVetContact} />
            </KeyboardAwareScrollView>
      </VetBottomSheet>
    </View>
  );
}
