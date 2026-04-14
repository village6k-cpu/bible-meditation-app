import { Text, View, StyleSheet } from 'react-native';
import { typography } from '../lib/theme';

interface Props {
  label: string;
  right?: React.ReactNode;
}

export function SectionLabel({ label, right }: Props) {
  return (
    <View style={styles.container}>
      <Text style={typography.sectionLabel}>{label}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
});
