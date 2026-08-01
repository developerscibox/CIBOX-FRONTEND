import { Pressable, Text } from 'react-native';
import { colors, radius } from '../constants/theme';
import AppText from './AppText';

export default function AppButton({
  title,
  onPress,
  disabled = false,
  variant = 'primary',
  style = {},
}) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: disabled
          ? '#999'
          : isPrimary
          ? colors.primary
          : colors.surface,
        borderWidth: isPrimary ? 0 : 1,
        borderColor: isPrimary ? 'transparent' : colors.border,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: radius.md,
        alignItems: 'center',
        ...style,
      }}
    >
      <AppText
        style={{
          color: isPrimary ? colors.primaryText : colors.text,
          fontWeight: '700',
          fontSize: 15,
        }}
      >
        {title}
      </AppText>
    </Pressable>
  );
}