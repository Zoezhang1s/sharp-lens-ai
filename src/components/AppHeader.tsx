import { useLanguage } from "@/contexts/LanguageContext";
import { Link, useLocation } from "react-router-dom";
import { Home, BookOpen, Clock, Globe } from "lucide-react";
import logoImg from "@/assets/logo.png";

const AppHeader = () => {
  const { lang, setLang, t } = useLanguage();
  const location = useLocation();

  const navItems = [
    { path: "/", icon: Home, label: t("首页", "Home") },
    { path: "/styles", icon: BookOpen, label: t("风格百科", "Styles") },
    { path: "/history", icon: Clock, label: t("历史记录", "History") },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
      <div className="container flex items-center justify-between h-14 px-4">
        <Link to="/" className="flex items-center gap-2 group">
          <img src={logoImg} alt="Logo" className="w-8 h-8 object-contain drop-shadow-[0_0_8px_hsl(38_92%_50%/0.4)]" />
          <span className="text-lg font-bold text-gradient-gold">{t("你拍的啥", "WhatDidYouShoot")}</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <item.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setLang(lang === "zh" ? "en" : "zh")}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-all ml-1"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{lang === "zh" ? "EN" : "中"}</span>
          </button>
        </nav>
      </div>
    </header>
  );
};

export default AppHeader;
