import { View, type ViewProps } from 'react-native';

/**
 * Plain white rounded card. Keep it dumb — individual screens handle
 * their own spacing and content.
 */
export function Card({ className, ...rest }: ViewProps & { className?: string }) {
  return (
    <View
      {...rest}
      className={`rounded-xl border border-border bg-white ${className ?? ''}`}
    />
  );
}
