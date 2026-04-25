"use client";

import { ChineseSearch } from "@/src/components/chinese/ChineseSearch";
import { useTranslations } from "next-intl";

export default function ChinesePage() {
  const t = useTranslations("Chinese");

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent">
          {t("title")}
        </h1>
        <p className="text-xl text-muted-foreground">{t("description")}</p>
      </div>

      <ChineseSearch />
    </div>
  );
}
