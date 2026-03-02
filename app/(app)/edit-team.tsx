import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
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

type Tab = 'settings' | 'members' | 'requests';

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
  const [uniqueCode, setUniqueCode] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

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
        .select('name, description, category, image_url, unique_code')
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
      setUniqueCode(data.unique_code);
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
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
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

  /* ─── Copy invite link ─── */
  const handleCopyInvite = async () => {
    const link = `arifit://join/${uniqueCode ?? teamId}`;
    await Clipboard.setStringAsync(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  /* ─── Accept / decline request ─── */
  const handleRequest = async (memberId: string, action: 'active' | 'declined') => {
    const { error } = await supabase
      .from('team_members')
      .update({ status: action })
      .eq('id', memberId);

    if (error) { Alert.alert('Error', error.message); return; }
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
    { key: 'members', label: 'Members', icon: 'people-outline', badge: members.length },
    { key: 'requests', label: 'Requests', icon: 'person-add-outline', badge: requests.length },
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
                  <View style={[styles.badge, tab.key === 'requests' && requests.length > 0 && styles.badgeAlert]}>
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
              uniqueCode={uniqueCode} teamId={teamId}
              linkCopied={linkCopied} handleCopyInvite={handleCopyInvite}
              saving={saving} handleSave={handleSave}
              deleting={deleting} handleDelete={handleDelete}
            />
          )}
          {activeTab === 'members' && (
            <MembersTab
              members={members}
              loading={membersLoading}
              onRemove={handleRemoveMember}
            />
          )}
          {activeTab === 'requests' && (
            <RequestsTab
              requests={requests}
              loading={membersLoading}
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
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
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
  uniqueCode: string | null;
  teamId: string | undefined;
  linkCopied: boolean;
  handleCopyInvite: () => void;
  saving: boolean;
  handleSave: () => void;
  deleting: boolean;
  handleDelete: () => void;
}

function SettingsTab({
  name, setName, description, setDescription,
  category, setCategory, displayImage, pickImage,
  uniqueCode, teamId, linkCopied, handleCopyInvite,
  saving, handleSave, deleting, handleDelete,
}: SettingsTabProps) {
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

      {/* Invite link */}
      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Invite Link</Text>
        <Text style={styles.sectionHint}>Share this link with clients to join your team</Text>
        <TouchableOpacity style={styles.inviteRow} activeOpacity={0.7} onPress={handleCopyInvite}>
          <View style={styles.inviteLinkBox}>
            <Ionicons name="link-outline" size={18} color={dark.textMuted} />
            <Text style={styles.inviteLinkText} numberOfLines={1}>arifit://join/{uniqueCode ?? teamId}</Text>
          </View>
          <View style={[styles.copyBtn, linkCopied && styles.copyBtnDone]}>
            <Ionicons name={linkCopied ? 'checkmark' : 'copy-outline'} size={18} color={linkCopied ? dark.successGreen : dark.accent} />
            <Text style={[styles.copyBtnText, linkCopied && styles.copyBtnTextDone]}>{linkCopied ? 'Copied' : 'Copy'}</Text>
          </View>
        </TouchableOpacity>
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
        <Text style={styles.emptyHint}>Share your invite link to get people to join</Text>
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
        <Text style={styles.emptyHint}>When someone uses your invite link, their request will appear here</Text>
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

  /* Invite */
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  inviteLinkBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: dark.inputBackgroundGlass, borderWidth: 1, borderColor: dark.inputBorderGlass,
    borderRadius: theme.borderRadius.lg, paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2, gap: theme.spacing.sm,
  },
  inviteLinkText: { flex: 1, fontSize: theme.fontSize.sm, color: dark.textSecondary },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: dark.accentBg, borderWidth: 1, borderColor: dark.glassButtonBorder,
    borderRadius: theme.borderRadius.lg, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm + 2,
  },
  copyBtnDone: { backgroundColor: dark.successGreenBg, borderColor: dark.successBorder },
  copyBtnText: { fontSize: theme.fontSize.sm, fontWeight: '600', color: dark.accent },
  copyBtnTextDone: { color: dark.successGreen },

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
