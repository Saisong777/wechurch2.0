import { useEffect, type ReactNode } from 'react';
import { ThemeProvider, useTheme } from 'next-themes';
import { ReadingPreferencesProvider } from './ReadingPreferences';

function BrowserThemeColor() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content', resolvedTheme === 'dark' ? '#151819' : '#F7F8FC',
    );
  }, [resolvedTheme]);
  return null;
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  return <ThemeProvider attribute="class" storageKey="wechurch-theme" defaultTheme="light"
    themes={['light', 'dark']} enableSystem enableColorScheme disableTransitionOnChange>
    <BrowserThemeColor />
    <ReadingPreferencesProvider>{children}</ReadingPreferencesProvider>
  </ThemeProvider>;
}
