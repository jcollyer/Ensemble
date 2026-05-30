import { Pressable, Text, View } from 'react-native';

/**
 * Three rating modes used by the Play Flashcards filter modal:
 *   - 'all' (default): no rating filter — all cards included.
 *   - 'basic': three-chip rating filter (Challenging / Good / Easy / No rating).
 *   - 'advanced': seven-chip filter over the advancedDifficultyLevel tokens.
 *
 * Styled to match `PlayModeToggle`. Active/inactive styles are applied via
 * inline `style` rather than a dynamic className — that keeps NativeWind's
 * generated styles stable across renders and rules out a JSX/styling
 * reconciliation issue that previously surfaced as a misleading
 * "navigation context" error on the second Pressable during a state flip.
 */
export type RatingMode = 'all' | 'basic' | 'advanced';

interface RatingModeToggleProps {
  value: RatingMode;
  onChange: (next: RatingMode) => void;
}

const ACTIVE_BG = { backgroundColor: '#ffffff' } as const;
// Match `shadow-sm` from Tailwind on iOS/Android. The values mirror what
// NativeWind compiles `shadow-sm` to so the look is unchanged.
const ACTIVE_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 1,
} as const;

const OPTIONS: { value: RatingMode; label: string }[] = [
  { value: 'all', label: 'All cards' },
  { value: 'basic', label: 'Basic' },
  { value: 'advanced', label: 'Advanced' },
];

export function RatingModeToggle({ value, onChange }: RatingModeToggleProps) {
  return (
    <View
      accessibilityRole="radiogroup"
      className="flex-row items-center gap-0.5 self-start rounded-full bg-slate-100 p-0.5"
    >
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.label}
            onPress={() => onChange(opt.value)}
            className="rounded-full px-3 py-1.5"
            style={selected ? [ACTIVE_BG, ACTIVE_SHADOW] : undefined}
          >
            <Text
              className="text-xs font-medium"
              style={{ color: selected ? '#0f172a' : '#64748b' }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
