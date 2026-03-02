import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

const dark = theme.dark.colors;

export const CATEGORIES = ['cardio', 'strength', 'flexibility', 'hiit', 'yoga', 'general'] as const;

export const teamFormStyles = StyleSheet.create({
  label: {
    fontSize: theme.fontSize.sm,
    color: dark.textSecondary,
    marginBottom: theme.spacing.xs + 2,
  },
  multilineInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  pill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.borderRadius.full,
    backgroundColor: dark.inputBackgroundGlass,
    borderWidth: 1,
    borderColor: dark.inputBorderGlass,
  },
  pillActive: {
    backgroundColor: dark.glassButtonBg,
    borderColor: dark.glassButtonBorder,
  },
  pillText: {
    fontSize: theme.fontSize.sm,
    color: dark.textSecondary,
    fontWeight: '500',
  },
  pillTextActive: {
    color: dark.accent,
    fontWeight: '600',
  },
  imageArea: {
    height: 140,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: dark.inputBorderGlass,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
  },
  imagePickerText: {
    fontSize: theme.fontSize.sm,
    color: dark.textMuted,
  },
  imagePreviewWrap: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: dark.imageOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  imageOverlayText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: '#fff',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: dark.accent,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
  },
  saveButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: dark.background,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
