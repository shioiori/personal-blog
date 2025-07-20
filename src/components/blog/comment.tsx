import { LanguageContext } from "@/src/context/language";
import { DiscussionEmbed } from "disqus-react";
import { useTranslations } from "next-intl";
import { useContext } from "react";

export default function DisqusComments({
  pageId,
  pageTitle,
  pageUrl
}: {
  pageId: string;
  pageTitle: string;
  pageUrl: string;
}) {
  const t = useTranslations("Comment");

  const disqusShortname = "clara-kurara";
  const languageContext = useContext(LanguageContext);

  const disqusConfig = {
    url: pageUrl,
    identifier: pageId,
    title: pageTitle,
    language: languageContext?.locale
  };

  return (
    <div className="mt-8">
      <h3 className="text-xl font-bold mb-4">{t("title")}</h3>
      <DiscussionEmbed shortname={disqusShortname} config={disqusConfig} />
    </div>
  );
}
