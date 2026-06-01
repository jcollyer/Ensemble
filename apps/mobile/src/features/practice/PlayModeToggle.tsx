import { ListOrdered, Shuffle } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

/**
 * Two play modes used by the mobile Play / Practice entry points:
 *   - 'in_order' (default): walk the deck in its existing chronological order.
 *   - 'shuffle': randomize once per session, re-shuffle on "Play again".
 *
 * Mirrors the web `PlayModeToggle` so the URL query param (`shuffle=1`) and
 * the user-visible labels stay consistent across platforms.
 */
export type PlayMode = 'in_order' | 'shuffle';

interface PlayModeToggleProps {
  value: PlayMode;
  onChange: (next: PlayMode) => void;
}

/**
 * Segmented toggle for choosing chronological vs shuffled playback. Placed
 * next to the Play / Practice button on every entry point.
 */
export function PlayModeToggle({ value, onChange }: PlayModeToggleProps) {
  return (
    <View
      accessibilityRole="radiogroup"
      className="flex-row items-center gap-0.5 self-start rounded-full bg-slate-100 p-0.5"
    >
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: value === 'in_order' }}
        onPress={() => onChange('in_order')}
        className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
        style={
          value === 'in_order'
            ? {
                backgroundColor: '#ffffff',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 1,
              }
            : undefined
        }
      >
        <ListOrdered size={12} color={value === 'in_order' ? '#0f172a' : '#64748b'} />
        <Text
          className="text-xs font-medium"
          style={{ color: value === 'in_order' ? '#0f172a' : '#64748b' }}
        >
          In order
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: value === 'shuffle' }}
        onPress={() => onChange('shuffle')}
        className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
        style={
          value === 'shuffle'
            ? {
                backgroundColor: '#ffffff',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 1,
              }
            : undefined
        }
      >
        <Shuffle size={12} color={value === 'shuffle' ? '#0f172a' : '#64748b'} />
        <Text
          className="text-xs font-medium"
          style={{ color: value === 'shuffle' ? '#0f172a' : '#64748b' }}
        >
          Shuffle
        </Text>
      </Pressable>
    </View>
  );
}
