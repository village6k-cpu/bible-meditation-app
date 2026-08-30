import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Palette, light, dark } from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeValue {
  palette: Palette;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue>({
  palette: light,
  isDark: false,
  mode: 'system',
  setMode: () => {},
});

const SETTING_KEY = 'themeMode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [SETTING_KEY])
      .then((row) => {
        if (row?.value === 'light' || row?.value === 'dark' || row?.value === 'system') {
          setModeState(row.value);
        }
      })
      .catch(() => {});
  }, [db]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      db.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
        [SETTING_KEY, next, next]
      ).catch(() => {});
    },
    [db]
  );

  const isDark = mode === 'system' ? system === 'dark' : mode === 'dark';

  return (
    <ThemeContext.Provider value={{ palette: isDark ? dark : light, isDark, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
