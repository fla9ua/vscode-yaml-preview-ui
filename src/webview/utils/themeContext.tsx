import * as React from 'react';
import { createContext, useContext, useEffect, useRef } from 'react';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  containerRef: React.RefObject<HTMLDivElement>;
  theme: ThemeMode;
}

const ThemeContext = createContext<ThemeContextType>({
  containerRef: { current: null },
  theme: 'dark'
});

// VSCodeのテーマを検出する関数
const detectVSCodeTheme = (): ThemeMode => {
  const bodyClasses = document.body.className;
  return bodyClasses.includes('vscode-light') ? 'light' : 'dark';
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = detectVSCodeTheme();

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.setAttribute('data-theme', theme);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ containerRef, theme }}>
      <div 
        ref={containerRef} 
        data-theme={theme}
        style={{ 
          width: '100%', 
          height: '100%',
          transition: 'background-color 0.3s ease, color 0.3s ease' 
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext); 