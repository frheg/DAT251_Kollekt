import { createContext, useContext, useEffect, useState } from "react";

const themes = [
  { name: "Lys", value: "light", colors: { accent: "#6366f1" } },
  { name: "Mørk", value: "dark", colors: { accent: "#18181b" } },
  { name: "Indigo", value: "indigo", colors: { accent: "#6366f1" } },
  { name: "Pink", value: "pink", colors: { accent: "#f472b6" } },
  { name: "Emerald", value: "emerald", colors: { accent: "#10b981" } },
];

const ThemeContext = createContext({
  theme: themes[0],
  setTheme: (theme: typeof themes[0]) => {},
  themes,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("kollekt-theme");
    return themes.find((t) => t.value === stored) || themes[0];
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme.value);
    localStorage.setItem("kollekt-theme", theme.value);
    // Remove all theme classes
    document.documentElement.classList.remove("dark", "theme-indigo", "theme-pink", "theme-emerald");
    // Add correct theme class
    if (theme.value === "dark") {
      document.documentElement.classList.add("dark");
    } else if (theme.value === "indigo" || theme.value === "pink" || theme.value === "emerald") {
      document.documentElement.classList.add(`theme-${theme.value}`);
      // Add dark class if system is dark or user previously selected dark
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add("dark");
      }
      // If you want to force light/dark for color themes, add logic here
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
