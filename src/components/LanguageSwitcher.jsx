import React from 'react';
import { useLanguage } from '@/components/LanguageContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
];

export default function LanguageSwitcher({ variant = "default" }) {
  const { language, changeLanguage } = useLanguage();
  const currentLang = languages.find(l => l.code === language) || languages[0];

  if (variant === "minimal") {
      return (
        <div className="flex gap-2">
            {languages.map(lang => (
                <button
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className={`text-xl hover:scale-110 transition-transform ${language === lang.code ? 'opacity-100' : 'opacity-50 grayscale hover:grayscale-0'}`}
                    title={lang.name}
                >
                    {lang.flag}
                </button>
            ))}
        </div>
      );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-[#d4c5b0] hover:bg-[#5c4430] hover:text-white">
          <Globe className="h-4 w-4" />
          <span className="hidden md:inline">{currentLang.name}</span>
          <span className="md:hidden">{currentLang.flag}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-[#4a3728] border-[#5c4430] text-[#e8dcc5]">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className="hover:bg-[#5c4430] focus:bg-[#5c4430] cursor-pointer gap-2"
          >
            <span>{lang.flag}</span>
            <span>{lang.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}