import * as React from 'react';
import { createContext, useState, useContext, useEffect, useRef } from 'react';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
  containerRef: { current: null }
});

export const ThemeProvider: React.FC<{ initialTheme?: ThemeMode; children: React.ReactNode }> = ({
  initialTheme = 'dark',
  children,
}) => {
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    // VSCodeのテーマ変更ではなく、コンテナにdata-theme属性を設定
    if (containerRef.current) {
      containerRef.current.setAttribute('data-theme', theme);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, containerRef }}>
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