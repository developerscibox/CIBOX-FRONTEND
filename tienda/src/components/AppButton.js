import { Pressable } from 'react-native';
import { colors, radius } from '../constants/theme';
import AppText from './AppText';

/**
 * Botón de la tienda, según el punto 07 del Manual de Diseño Digital:
 *
 *   primario   → fondo VERDE LIMA con texto oscuro   ("Comprar ahora")
 *   secundario → fondo AZUL OSCURO con texto blanco  ("Ver ofertas")
 *   hover      → AZUL MEDIO
 *
 * El lima es el color de acción de la marca; el azul acompaña. Estaban al revés
 * —primario azul y secundario blanco con borde—, que es justo la lectura opuesta
 * a la del manual: el botón que más pesa se leía como el más discreto.
 */
export default function AppButton({
  title,
  onPress,
  disabled = false,
  variant = 'primary',
  style = {},
}) {
  const isPrimary = variant === 'primary';

  // El rótulo se decide por el fondo que tiene DEBAJO, no por la variante: en
  // hover el primario deja de ser lima y pasa a azul medio, y el texto oscuro
  // que se lee perfecto sobre el lima (10,1:1) cae a 2,7:1 sobre ese azul. Solo
  // el fondo lima lleva texto oscuro; los dos azules lo llevan blanco.
  const fondo = (hovered) =>
    disabled ? '#999' : hovered ? colors.primaryMid : isPrimary ? colors.accent : colors.primaryDark;
  const rotulo = (hovered) =>
    !disabled && !hovered && isPrimary ? colors.accentText : colors.primaryText;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ hovered, pressed }) => ({
        backgroundColor: fondo(hovered || pressed),
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: radius.md,
        alignItems: 'center',
        ...style,
      })}
    >
      {({ hovered, pressed }) => (
        <AppText weight="bold" style={{ color: rotulo(hovered || pressed), fontSize: 15 }}>
          {title}
        </AppText>
      )}
    </Pressable>
  );
}