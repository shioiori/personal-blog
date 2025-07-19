import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState
} from "react";
import { Language } from "../components/enums";
import { getMessages } from "../utils/locale";
import { NextIntlClientProvider } from "next-intl";
import { Loading } from "../components/ui/loading";

interface LanguageContextType {
  locale?: Language;
  setLocale: (locale: Language) => void;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

export function LanguageProvider({
  children,
  locale
}: {
  children: ReactNode;
  locale: Language;
}) {
  const [currentLocale, setCurrentLocale] = useState<Language>();
  const [messages, setMessages] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const setLocale = async (locale: Language) => {
    setIsLoading(true);
    setCurrentLocale(locale);
    const messages = await getMessages(locale as string);
    setMessages(messages);
    setIsLoading(false);
  };

  if (currentLocale == null) {
    setLocale(locale);
  }

  if (isLoading) {
    return <Loading />;
  }

  return (
    <LanguageContext.Provider
      value={{
        locale: currentLocale,
        setLocale
      }}
    >
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </LanguageContext.Provider>
  );
}
