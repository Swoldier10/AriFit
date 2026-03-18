import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import ScreenBackground from '@/components/ui/ScreenBackground';
import GlassCard from '@/components/ui/GlassCard';
import GlassInput from '@/components/ui/GlassInput';
import { pickImage as pickImageUtil, uploadImage } from '@/lib/image-utils';
import { teamFormStyles, CATEGORIES } from '@/components/ui/teamFormStyles';

const dark = theme.dark.colors;

/** Extract the storage path from a Supabase public URL */
const extractStoragePath = (url: string): string | null => {
  const marker = '/object/public/team-images/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length).split('?')[0];
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface ScheduleEntry {
  id?: string;
  day_of_week: number;
  start_time: string;
}

type Tab = 'settings' | 'members';

interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

/* ═══════════════════════════════════════════════════════════════════ */

export default function EditTeamScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { id: teamId } = useLocalSearchParams<{ id: string }>();

  const [activeTab, setActiveTab] = useState<Tab>('members');
  const [loading, setLoading] = useState(true);

  /* Settings state */
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('general');
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [newImageUri, setNewImageUri] = useState<string | null>(null);

  /* Schedule state */
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [addingSession, setAddingSession] = useState(false);
  const [newDay, setNewDay] = useState(0);
  const [newHour, setNewHour] = useState('08');
  const [newMinute, setNewMinute] = useState('00');

  /* Members state */
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [requests, setRequests] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  /* ─── Fetch team data ─── */
  useEffect(() => {
    if (!teamId) return;
    (async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('name, description, category, image_url')
        .eq('id', teamId)
        .single();

      if (error || !data) {
        Alert.alert('Error', 'Could not load team');
        router.back();
        return;
      }

      setName(data.name);
      setDescription(data.description ?? '');
      setCategory(data.category);
      setExistingImageUrl(data.image_url);

      const { data: schedData } = await supabase
        .from('team_schedules')
        .select('id, day_of_week, start_time')
        .eq('team_id', teamId)
        .order('day_of_week')
        .order('start_time');
      if (schedData) setSchedules(schedData);

      setLoading(false);
    })();
  }, [teamId]);

  /* ─── Fetch members + requests ─── */
  const fetchMembers = useCallback(async () => {
    if (!teamId) return;
    setMembersLoading(true);

    const { data } = await supabase
      .from('team_members')
      .select('id, user_id, role, status, joined_at, profiles(full_name, avatar_url)')
      .eq('team_id', teamId)
      .order('joined_at', { ascending: true });

    if (data) {
      const rows = data as unknown as MemberRow[];
      setMembers(rows.filter((m) => m.status === 'active'));
      setRequests(rows.filter((m) => m.status === 'pending'));
    }

    setMembersLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  /* ─── Image picker ─── */
  const pickImage = async () => {
    const uri = await pickImageUtil({ aspect: [16, 9] });
    if (uri) setNewImageUri(uri);
  };

  /* ─── Upload image ─── */
  const handleUploadImage = async (): Promise<string | null> => {
    if (!newImageUri || !session?.user?.id || !teamId) return null;
    const ext = newImageUri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const filePath = `${session.user.id}/${teamId}.${ext}`;

    // Remove old image if it exists with a different path (extension changed)
    if (existingImageUrl) {
      const oldPath = extractStoragePath(existingImageUrl);
      if (oldPath && oldPath !== filePath) {
        await supabase.storage.from('team-images').remove([oldPath]);
      }
    }

    const url = await uploadImage(newImageUri, 'team-images', filePath);
    if (!url) return null;
    // Append timestamp to bust CDN/image cache so the new image is shown
    return `${url}?t=${Date.now()}`;
  };

  /* ─── Save ─── */
  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Team name is required'); return; }
    if (!teamId) return;
    setSaving(true);
    const updates: Record<string, any> = {
      name: name.trim(),
      description: description.trim() || null,
      category,
    };
    if (newImageUri) {
      const url = await handleUploadImage();
      if (url) updates.image_url = url;
    }
    const { error } = await supabase.from('teams').update(updates).eq('id', teamId);
    if (error) { setSaving(false); Alert.alert('Error', error.message); return; }

    // Save schedules: delete all then re-insert
    await supabase.from('team_schedules').delete().eq('team_id', teamId);
    if (schedules.length > 0) {
      const { error: schedError } = await supabase.from('team_schedules').insert(
        schedules.map((s) => ({
          team_id: teamId,
          day_of_week: s.day_of_week,
          start_time: s.start_time,
        }))
      );
      if (schedError) { setSaving(false); Alert.alert('Error', schedError.message); return; }
    }

    setSaving(false);
    router.back();
  };

  /* ─── Delete ─── */
  const handleDelete = () => {
    Alert.alert('Delete Team', 'This action cannot be undone. All members will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!teamId) return;
          setDeleting(true);
          // Remove image from storage
          if (existingImageUrl) {
            const oldPath = extractStoragePath(existingImageUrl);
            if (oldPath) {
              await supabase.storage.from('team-images').remove([oldPath]);
            }
          }
          await supabase.from('team_members').delete().eq('team_id', teamId);
          const { error } = await supabase.from('teams').delete().eq('id', teamId);
          setDeleting(false);
          if (error) { Alert.alert('Error', error.message); return; }
          router.back();
        },
      },
    ]);
  };

  /* ─── Accept / decline request ─── */
  const handleRequest = async (memberId: string, action: 'active' | 'declined') => {
    const { error } = await supabase
      .from('team_members')
      .update({ status: action })
      .eq('id', memberId);

    if (error) { Alert.alert('Error', error.message); return; }

    // Auto-add to trainer_clients when accepting
    if (action === 'active' && session?.user?.id) {
      const member = requests.find((r) => r.id === memberId);
      if (member) {
        const { data: existing } = await supabase
          .from('trainer_clients')
          .select('id')
          .eq('trainer_id', session.user.id)
          .eq('client_id', member.user_id)
          .maybeSingle();

        if (!existing) {
          await supabase.from('trainer_clients').insert({
            trainer_id: session.user.id,
            client_id: member.user_id,
            status: 'active',
          });
        }
      }
    }

    fetchMembers();
  };

  /* ─── Remove member ─── */
  const handleRemoveMember = (member: MemberRow) => {
    if (member.role === 'owner') return;
    Alert.alert('Remove Member', `Remove ${member.profiles?.full_name ?? 'this member'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('team_members').delete().eq('id', member.id);
          fetchMembers();
        },
      },
    ]);
  };

  const displayImage = newImageUri ?? existingImageUrl;

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={dark.accent} size="large" />
      </View>
    );
  }

  /* ═══════════════════════════════ TABS ═══════════════════════════════ */

  const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; badge?: number }[] = [
    { key: 'members', label: 'Members', icon: 'people-outline', badge: members.length + requests.length },
    { key: 'settings', label: 'Settings', icon: 'settings-outline' },
  ];

  return (
    <ScreenBackground gradientColors={['rgba(11,17,32,0.70)', 'rgba(11,17,32,0.85)', 'rgba(11,17,32,0.95)'] as const}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={dark.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{name || 'Edit Team'}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, isActive && styles.tabActive]}
                activeOpacity={0.7}
                onPress={() => setActiveTab(tab.key)}
              >
                <Ionicons
                  name={tab.icon}
                  size={18}
                  color={isActive ? dark.accent : dark.textMuted}
                />
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
                {(tab.badge ?? 0) > 0 && (
                  <View style={[styles.badge, tab.key === 'members' && requests.length > 0 && styles.badgeAlert]}>
                    <Text style={styles.badgeText}>{tab.badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Content */}
        <ScrollView
          key={activeTab}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {activeTab === 'settings' && (
            <SettingsTab
              name={name} setName={setName}
              description={description} setDescription={setDescription}
              category={category} setCategory={setCategory}
              displayImage={displayImage} pickImage={pickImage}
              saving={saving} handleSave={handleSave}
              deleting={deleting} handleDelete={handleDelete}
              schedules={schedules} setSchedules={setSchedules}
              addingSession={addingSession} setAddingSession={setAddingSession}
              newDay={newDay} setNewDay={setNewDay}
              newHour={newHour} setNewHour={setNewHour}
              newMinute={newMinute} setNewMinute={setNewMinute}
            />
          )}
          {activeTab === 'members' && (
            membersLoading ? (
              <ActivityIndicator color={dark.accent} style={{ marginTop: 40 }} />
            ) : (
              <>
                {requests.length > 0 && (
                  <CollapsibleSection title="Requests" icon="person-add-outline" count={requests.length}>
                    <RequestsTab
                      requests={requests}
                      loading={false}
                      onAccept={(id) => handleRequest(id, 'active')}
                      onDecline={(id) => {
                        const req = requests.find((r) => r.id === id);
                        Alert.alert(
                          'Decline Request',
                          `Decline ${req?.profiles?.full_name ?? 'this request'}?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Decline', style: 'destructive', onPress: () => handleRequest(id, 'declined') },
                          ],
                        );
                      }}
                    />
                  </CollapsibleSection>
                )}
                <CollapsibleSection title="Members" icon="people-outline" count={members.length}>
                  <MembersTab
                    members={members}
                    loading={false}
                    onRemove={handleRemoveMember}
                  />
                </CollapsibleSection>
              </>
            )
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

/* ═════════════════════ COLLAPSIBLE SECTION ═════════════════════ */

function CollapsibleSection({
  title,
  icon,
  count,
  children,
  defaultExpanded = false,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  return (
    <View style={styles.collapsibleWrapper}>
      <TouchableOpacity style={styles.collapsibleHeader} activeOpacity={0.7} onPress={toggle}>
        <Ionicons name={icon} size={18} color={dark.accent} />
        <Text style={styles.collapsibleHeaderText}>{title}</Text>
        <View style={styles.collapsibleCount}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={dark.textMuted}
        />
      </TouchableOpacity>
      {expanded && <View style={styles.collapsibleBody}>{children}</View>}
    </View>
  );
}

/* ══════════════════════════ SETTINGS TAB ══════════════════════════ */

interface SettingsTabProps {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  displayImage: string | null;
  pickImage: () => void;
  saving: boolean;
  handleSave: () => void;
  deleting: boolean;
  handleDelete: () => void;
  schedules: ScheduleEntry[];
  setSchedules: (v: ScheduleEntry[]) => void;
  addingSession: boolean;
  setAddingSession: (v: boolean) => void;
  newDay: number;
  setNewDay: (v: number) => void;
  newHour: string;
  setNewHour: (v: string) => void;
  newMinute: string;
  setNewMinute: (v: string) => void;
}

function SettingsTab({
  name, setName, description, setDescription,
  category, setCategory, displayImage, pickImage,
  saving, handleSave, deleting, handleDelete,
  schedules, setSchedules, addingSession, setAddingSession,
  newDay, setNewDay, newHour, setNewHour, newMinute, setNewMinute,
}: SettingsTabProps) {
  const sortedSchedules = [...schedules].sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));

  const handleAddSession = () => {
    const h = parseInt(newHour, 10);
    const m = parseInt(newMinute, 10);
    if (isNaN(h) || h < 0 || h > 23) { Alert.alert('Invalid hour', 'Hour must be 0–23'); return; }
    if (isNaN(m) || m < 0 || m > 59) { Alert.alert('Invalid minute', 'Minute must be 0–59'); return; }
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const duplicate = schedules.some((s) => s.day_of_week === newDay && s.start_time.slice(0, 5) === time);
    if (duplicate) { Alert.alert('Duplicate', 'A session at this day and time already exists'); return; }
    setSchedules([...schedules, { day_of_week: newDay, start_time: time }]);
    setAddingSession(false);
    setNewHour('08');
    setNewMinute('00');
  };

  const handleDeleteSchedule = (index: number) => {
    setSchedules(sortedSchedules.filter((_, i) => i !== index));
  };

  return (
    <>
      <GlassCard>
        <GlassInput label="Team Name" icon="people-outline" placeholder="e.g. Morning HIIT Squad" value={name} onChangeText={setName} />
        <GlassInput label="Description" icon="document-text-outline" placeholder="What's this team about?" value={description} onChangeText={setDescription} multiline numberOfLines={3} style={teamFormStyles.multilineInput} />

        <Text style={teamFormStyles.label}>Category</Text>
        <View style={teamFormStyles.pillRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity key={cat} style={[teamFormStyles.pill, category === cat && teamFormStyles.pillActive]} onPress={() => setCategory(cat)}>
              <Text style={[teamFormStyles.pillText, category === cat && teamFormStyles.pillTextActive]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={teamFormStyles.label}>Cover Image</Text>
        <TouchableOpacity style={teamFormStyles.imageArea} activeOpacity={0.7} onPress={pickImage}>
          {displayImage ? (
            <View style={teamFormStyles.imagePreviewWrap}>
              <Image source={{ uri: displayImage }} style={teamFormStyles.imagePreview} contentFit="cover" />
              <View style={teamFormStyles.imageOverlay}>
                <Ionicons name="camera" size={22} color="#fff" />
                <Text style={teamFormStyles.imageOverlayText}>Change</Text>
              </View>
            </View>
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={28} color={dark.textMuted} />
              <Text style={teamFormStyles.imagePickerText}>Tap to choose an image</Text>
            </>
          )}
        </TouchableOpacity>
      </GlassCard>

      {/* Training Schedule */}
      <GlassCard style={styles.scheduleCard}>
        <View style={styles.scheduleSectionHeader}>
          <Ionicons name="calendar-outline" size={20} color={dark.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Training Schedule</Text>
            <Text style={styles.sectionHint}>Set when sessions take place each week</Text>
          </View>
        </View>

        {sortedSchedules.length > 0 ? (
          <GlassCard padding={0} style={{ marginTop: theme.spacing.sm }}>
            {sortedSchedules.map((s, i) => (
              <View key={`${s.day_of_week}-${s.start_time}-${i}`}>
                <View style={styles.scheduleRow}>
                  <Text style={styles.scheduleDayText}>{DAY_NAMES[s.day_of_week]}</Text>
                  <Text style={styles.scheduleTimeText}>{s.start_time.slice(0, 5)}</Text>
                  <TouchableOpacity style={styles.scheduleDeleteBtn} onPress={() => handleDeleteSchedule(i)}>
                    <Ionicons name="close" size={14} color={dark.error} />
                  </TouchableOpacity>
                </View>
                {i < sortedSchedules.length - 1 && <View style={styles.memberDivider} />}
              </View>
            ))}
          </GlassCard>
        ) : (
          <Text style={[styles.sectionHint, { marginTop: theme.spacing.sm }]}>No sessions scheduled</Text>
        )}

        {addingSession && (
          <View style={styles.addSessionCard}>
            <View style={[teamFormStyles.pillRow, { justifyContent: 'center' }]}>
              {DAY_NAMES.map((d, i) => (
                <TouchableOpacity
                  key={d}
                  style={[teamFormStyles.pill, newDay === i && teamFormStyles.pillActive]}
                  onPress={() => setNewDay(i)}
                >
                  <Text style={[teamFormStyles.pillText, newDay === i && teamFormStyles.pillTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.timeInputRow}>
              <View style={{ flex: 1 }}>
                <GlassInput
                  label="Hour"
                  placeholder="08"
                  value={newHour}
                  onChangeText={(t) => setNewHour(t.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={styles.timeInput}
                />
              </View>
              <Text style={styles.colonText}>:</Text>
              <View style={{ flex: 1 }}>
                <GlassInput
                  label="Min"
                  placeholder="00"
                  value={newMinute}
                  onChangeText={(t) => setNewMinute(t.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={styles.timeInput}
                />
              </View>
            </View>

            <View style={styles.actionBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.7} onPress={() => setAddingSession(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtn} activeOpacity={0.8} onPress={handleAddSession}>
                <Ionicons name="checkmark" size={18} color={dark.background} />
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!addingSession && (
          <TouchableOpacity
            style={styles.addSessionBtn}
            activeOpacity={0.8}
            onPress={() => setAddingSession(true)}
          >
            <Text style={styles.addBtnText}>Add Session</Text>
          </TouchableOpacity>
        )}
      </GlassCard>

      {/* Save */}
      <TouchableOpacity style={[teamFormStyles.saveButton, styles.saveButtonMargin, saving && teamFormStyles.buttonDisabled]} activeOpacity={0.8} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color={dark.background} /> : (
          <><Ionicons name="checkmark-circle" size={20} color={dark.background} /><Text style={teamFormStyles.saveButtonText}>Save Changes</Text></>
        )}
      </TouchableOpacity>

      {/* Danger zone */}
      <GlassCard style={styles.dangerCard}>
        <View style={styles.dangerHeader}>
          <Ionicons name="warning-outline" size={20} color={dark.error} />
          <Text style={styles.dangerTitle}>Danger Zone</Text>
        </View>
        <Text style={styles.dangerHint}>Deleting a team is permanent. All members will be removed.</Text>
        <TouchableOpacity style={[styles.deleteButton, deleting && teamFormStyles.buttonDisabled]} activeOpacity={0.8} onPress={handleDelete} disabled={deleting}>
          {deleting ? <ActivityIndicator color={dark.error} /> : (
            <><Ionicons name="trash-outline" size={18} color={dark.error} /><Text style={styles.deleteButtonText}>Delete Team</Text></>
          )}
        </TouchableOpacity>
      </GlassCard>
    </>
  );
}

/* ══════════════════════════ MEMBERS TAB ═══════════════════════════ */

function MembersTab({ members, loading, onRemove }: {
  members: MemberRow[];
  loading: boolean;
  onRemove: (m: MemberRow) => void;
}) {
  if (loading) return <ActivityIndicator color={dark.accent} style={{ marginTop: 40 }} />;

  if (members.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="people-outline" size={40} color={dark.textMuted} />
        <Text style={styles.emptyTitle}>No members yet</Text>
        <Text style={styles.emptyHint}>Assign clients to this team from the Members tab</Text>
      </View>
    );
  }

  return (
    <GlassCard padding={0}>
      {members.map((m, i) => (
        <View key={m.id}>
          <View style={styles.memberRow}>
            <View style={styles.memberAvatar}>
              {m.profiles?.avatar_url ? (
                <Image source={{ uri: m.profiles.avatar_url }} style={styles.memberAvatarImg} />
              ) : (
                <Ionicons name="person" size={18} color={dark.textMuted} />
              )}
            </View>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{m.profiles?.full_name ?? 'Unknown'}</Text>
              <Text style={styles.memberRole}>
                {m.role === 'owner' ? 'Owner' : 'Member'}
              </Text>
            </View>
            {m.role === 'owner' ? (
              <View style={styles.ownerBadge}>
                <Ionicons name="shield-checkmark" size={14} color={dark.accent} />
              </View>
            ) : (
              <TouchableOpacity style={styles.memberRemoveBtn} onPress={() => onRemove(m)}>
                <Ionicons name="close" size={16} color={dark.error} />
              </TouchableOpacity>
            )}
          </View>
          {i < members.length - 1 && <View style={styles.memberDivider} />}
        </View>
      ))}
    </GlassCard>
  );
}

/* ══════════════════════════ REQUESTS TAB ══════════════════════════ */

function RequestsTab({ requests, loading, onAccept, onDecline }: {
  requests: MemberRow[];
  loading: boolean;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  if (loading) return <ActivityIndicator color={dark.accent} style={{ marginTop: 40 }} />;

  if (requests.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="person-add-outline" size={40} color={dark.textMuted} />
        <Text style={styles.emptyTitle}>No pending requests</Text>
        <Text style={styles.emptyHint}>No pending requests at this time</Text>
      </View>
    );
  }

  return (
    <GlassCard padding={0}>
      {requests.map((m, i) => (
        <View key={m.id}>
          <View style={styles.requestRow}>
            <View style={styles.memberAvatar}>
              {m.profiles?.avatar_url ? (
                <Image source={{ uri: m.profiles.avatar_url }} style={styles.memberAvatarImg} />
              ) : (
                <Ionicons name="person" size={18} color={dark.textMuted} />
              )}
            </View>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{m.profiles?.full_name ?? 'Unknown'}</Text>
              <Text style={styles.memberRole}>Wants to join</Text>
            </View>
            <View style={styles.requestActions}>
              <TouchableOpacity
                style={styles.requestAcceptBtn}
                activeOpacity={0.7}
                onPress={() => onAccept(m.id)}
              >
                <Ionicons name="checkmark" size={18} color={dark.successGreen} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.requestDeclineBtn}
                activeOpacity={0.7}
                onPress={() => onDecline(m.id)}
              >
                <Ionicons name="close" size={18} color={dark.error} />
              </TouchableOpacity>
            </View>
          </View>
          {i < requests.length - 1 && <View style={styles.memberDivider} />}
        </View>
      ))}
    </GlassCard>
  );
}

/* ══════════════════════════ STYLES ════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.background },
  safeArea: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: dark.glassCircleBg,
    borderWidth: 1, borderColor: dark.glassCircleBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: dark.text,
  },

  /* Tab bar */
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    backgroundColor: dark.whiteOverlay5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: dark.whiteOverlay10,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 16,
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: dark.textMuted,
  },
  tabTextActive: {
    color: dark.accent,
  },
  badge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeAlert: {
    backgroundColor: dark.accentBorder,
  },
  badgeText: {
    fontSize: 10, fontWeight: '700', color: dark.text,
  },

  /* Scroll */
  scroll: { flex: 1 },
  scrollContent: { padding: theme.spacing.lg, paddingBottom: 60 },

  /* Sections */
  sectionCard: { marginTop: theme.spacing.lg },
  sectionTitle: { fontSize: theme.fontSize.md, fontWeight: '700', color: dark.text, marginBottom: 4 },
  sectionHint: { fontSize: theme.fontSize.sm, color: dark.textMuted, marginBottom: theme.spacing.md },

  /* Schedule */
  scheduleCard: { marginTop: theme.spacing.lg },
  scheduleSectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md + 2,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  scheduleDayText: {
    fontWeight: '700',
    color: dark.accent,
    fontSize: theme.fontSize.md,
    width: 44,
  },
  scheduleTimeText: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: dark.textSecondary,
  },
  scheduleDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: dark.errorBg,
    borderWidth: 1,
    borderColor: dark.errorBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSessionCard: {
    backgroundColor: dark.whiteOverlay5,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  timeInput: {
    textAlign: 'center',
  },
  colonText: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: dark.textSecondary,
    marginTop: theme.spacing.xs,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: dark.accent,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.sm + 2,
  },
  addBtnText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: dark.background,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: dark.whiteOverlay5,
    borderWidth: 1,
    borderColor: dark.whiteOverlay10,
  },
  cancelBtnText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: dark.textMuted,
  },
  addSessionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: dark.accent,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    marginTop: theme.spacing.md,
  },

  /* Save */
  saveButtonMargin: { marginTop: theme.spacing.lg },

  /* Danger */
  dangerCard: { marginTop: theme.spacing.lg },
  dangerHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: 4 },
  dangerTitle: { fontSize: theme.fontSize.md, fontWeight: '700', color: dark.error },
  dangerHint: { fontSize: theme.fontSize.sm, color: dark.textMuted, marginBottom: theme.spacing.md },
  deleteButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm,
    backgroundColor: dark.errorBg, borderWidth: 1, borderColor: dark.errorBorder,
    borderRadius: theme.borderRadius.lg, paddingVertical: theme.spacing.sm + 4,
  },
  deleteButtonText: { fontSize: theme.fontSize.md, fontWeight: '600', color: dark.error },

  /* Collapsible sections */
  collapsibleWrapper: {
    marginBottom: theme.spacing.md,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: dark.whiteOverlay5,
    borderWidth: 1,
    borderColor: dark.whiteOverlay10,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4,
  },
  collapsibleHeaderText: {
    flex: 1,
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: dark.text,
  },
  collapsibleCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  collapsibleBody: {
    marginTop: theme.spacing.sm,
  },

  /* Members / Requests rows */
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md + 2, paddingVertical: theme.spacing.md,
  },
  memberDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: theme.spacing.md + 2,
  },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: dark.whiteOverlay6, borderWidth: 1, borderColor: dark.whiteOverlay10,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  memberAvatarImg: { width: '100%', height: '100%' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: theme.fontSize.md, fontWeight: '600', color: dark.text },
  memberRole: { fontSize: theme.fontSize.sm - 1, color: dark.textSecondary, marginTop: 2 },
  ownerBadge: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: dark.accentBg, borderWidth: 1, borderColor: dark.accentBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  memberRemoveBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: dark.errorBg, borderWidth: 1, borderColor: dark.errorBorder,
    alignItems: 'center', justifyContent: 'center',
  },

  /* Request row + actions */
  requestRow: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md + 2, paddingVertical: theme.spacing.md,
  },
  requestActions: {
    flexDirection: 'row', gap: theme.spacing.xs + 2,
  },
  requestAcceptBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: dark.successGreenBg, borderWidth: 1, borderColor: dark.successBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  requestDeclineBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: dark.errorBg, borderWidth: 1, borderColor: dark.errorBorder,
    alignItems: 'center', justifyContent: 'center',
  },

  /* Empty state */
  emptyState: {
    alignItems: 'center', paddingVertical: theme.spacing.xxl, gap: theme.spacing.xs,
  },
  emptyTitle: { fontSize: theme.fontSize.md, fontWeight: '600', color: dark.textSecondary, marginTop: theme.spacing.sm },
  emptyHint: { fontSize: theme.fontSize.sm, color: dark.textMuted, textAlign: 'center', paddingHorizontal: theme.spacing.xl },
});
