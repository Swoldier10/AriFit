import { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';

const dark = theme.dark.colors;

interface GlassInputProps extends TextInputProps {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export default function GlassInput({ label, icon, style, ...rest }: GlassInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.container,
          focused && styles.containerFocused,
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? dark.accentLight : dark.textMuted}
            style={styles.icon}
          />
        )}
        <TextInput
          placeholderTextColor={dark.textMuted}
          style={[styles.input, style]}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          {...rest}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSize.sm,
    color: dark.textSecondary,
    marginBottom: theme.spacing.xs + 2,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.inputBackgroundGlass,
    borderWidth: 1,
    borderColor: dark.inputBorderGlass,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
  },
  containerFocused: {
    borderColor: dark.accentLight,
    backgroundColor: dark.whiteOverlay10,
  },
  icon: {
    marginRight: theme.spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: theme.spacing.sm + 4,
    fontSize: theme.fontSize.md,
    color: dark.text,
  },
});
