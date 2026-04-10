import React, { createContext, useContext, useState, useCallback } from "react";

type Language = "zh" | "en";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (zh: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem("app-lang");
    return (saved === "en" ? "en" : "zh") as Language;
  });

  const handleSetLang = useCallback((l: Language) => {
    setLang(l);
    localStorage.setItem("app-lang", l);
  }, []);

  const t = useCallback((zh: string, en: string) => (lang === "zh" ? zh : en), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang: handleSetLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
