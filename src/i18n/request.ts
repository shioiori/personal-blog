import { createTranslator } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }
  return {
    locale,
    messages: {
      ...(await import(`../../messages/${locale}/common.json`)).default,
      ...(await import(`../../messages/${locale}/aboutme.json`)).default,
      ...(await import(`../../messages/${locale}/blog.json`)).default,
      ...(await import(`../../messages/${locale}/music.json`)).default,
      ...(await import(`../../messages/${locale}/home.json`)).default,
      ...(await import(`../../messages/${locale}/project.json`)).default
    }
  };
});

let messages = {};
export const getTranslation = async (
  namespace: string,
  key: string,
  values: any = undefined,
  locale: string = "vi"
) => {
  messages =
    Object.keys(messages).length == 0
      ? (await import(`../../messages/${locale}/common.json`)).default
      : messages;

  const t = createTranslator({ locale, messages, namespace });
  return values ? t(key, values) : t(key);
};
