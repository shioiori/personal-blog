"use client";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "./language";
import { MusicProvider } from "./music";
import { AuthProvider } from "./auth";
import { Language } from "../components/enums";

export function Providers({
  children,
  locale
}: {
  children: React.ReactNode;
  locale: Language;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange={true}
    >
      <LanguageProvider locale={locale}>
        <AuthProvider>
          <MusicProvider>{children}</MusicProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
