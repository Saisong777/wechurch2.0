import { useEffect, type ReactNode } from 'react';
import { ThemeProvider, useTheme } from 'next-themes';

function BrowserThemeColor() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content', resolvedTheme === 'dark' ? '#151819' : '#F8FAF9',
    );
  }, [resolvedTheme]);
  return null;
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  return <ThemeProvider attribute="class" storageKey="wechurch-theme" defaultTheme="light"
    themes={['light', 'dark']} enableSystem enableColorScheme disableTransitionOnChange>
    <BrowserThemeColor />
    {children}
  </ThemeProvider>;
}
