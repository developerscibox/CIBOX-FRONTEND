import { TextInput, View } from 'react-native';
import { colors, radius } from '../constants/theme';

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar productos...',
}) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        paddingHorizontal: 12,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        style={{
          height: 44,
          color: colors.text,
        }}
        placeholderTextColor="#999"
      />
    </View>
  );
}