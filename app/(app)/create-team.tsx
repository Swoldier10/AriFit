import { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { pickImage as pickImageUtil, uploadImage } from '@/lib/image-utils';
import { theme } from '@/constants/theme';
import GlassCard from '@/components/ui/GlassCard';
import GlassInput from '@/components/ui/GlassInput';
import { teamFormStyles, CATEGORIES } from '@/components/ui/teamFormStyles';

const dark = theme.dark.colors;

export default function CreateTeamScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('general');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* ─── Image picker ─── */
  const pickImage = async () => {
    const uri = await pickImageUtil({ aspect: [16, 9] });
    if (uri) setImageUri(uri);
  };

  /* ─── Upload image to Supabase Storage ─── */
  const handleUploadImage = async (teamId: string): Promise<string | null> => {
    if (!imageUri || !session?.user?.id) return null;
    const ext = imageUri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const filePath = `${session.user.id}/${teamId}.${ext}`;
    return uploadImage(imageUri, 'team-images', filePath);
  };

  /* ─── Create team ─── */
  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Team name is required');
      return;
    }
    if (!session?.user?.id) return;

    setSubmitting(true);

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        category,
        created_by: session.user.id,
      })
      .select('id')
      .single();

    if (teamError) {
      setSubmitting(false);
      Alert.alert('Error', teamError.message);
      return;
    }

    // Upload cover image (if selected) and update the team record
    const imageUrl = await handleUploadImage(team.id);
    if (imageUrl) {
      await supabase.from('teams').update({ image_url: imageUrl }).eq('id', team.id);
    }

    // Add creator as owner member
    await supabase.from('team_members').insert({
      team_id: team.id,
      user_id: session.user.id,
      role: 'owner',
    });

    setSubmitting(false);
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Create New Team</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={dark.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <GlassCard>
          <GlassInput
            label="Team Name"
            icon="people-outline"
            placeholder="e.g. Morning HIIT Squad"
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <GlassInput
            label="Description"
            icon="document-text-outline"
            placeholder="What's this team about?"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            style={teamFormStyles.multilineInput}
          />

          {/* Category */}
          <Text style={teamFormStyles.label}>Category</Text>
          <View style={teamFormStyles.pillRow}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  teamFormStyles.pill,
                  category === cat && teamFormStyles.pillActive,
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text
                  style={[
                    teamFormStyles.pillText,
                    category === cat && teamFormStyles.pillTextActive,
                  ]}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Cover Image */}
          <Text style={teamFormStyles.label}>Cover Image</Text>
          <TouchableOpacity
            style={teamFormStyles.imageArea}
            activeOpacity={0.7}
            onPress={pickImage}
          >
            {imageUri ? (
              <View style={teamFormStyles.imagePreviewWrap}>
                <Image
                  source={{ uri: imageUri }}
                  style={teamFormStyles.imagePreview}
                  contentFit="cover"
                />
                {/* Change overlay */}
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

        {/* Create button */}
        <TouchableOpacity
          style={[styles.createButton, submitting && styles.createButtonDisabled]}
          activeOpacity={0.8}
          onPress={handleCreate}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={dark.background} />
          ) : (
            <>
              <Ionicons name="add-circle" size={20} color={dark.background} />
              <Text style={styles.createButtonText}>Create Team</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  headerTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: dark.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: dark.surface,
    borderWidth: 1,
    borderColor: dark.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: dark.accent,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: dark.background,
  },
});
