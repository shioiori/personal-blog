"use client";

import { Mail, MapPin, Bell } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function PersonalInfo() {
  const t = useTranslations("Home");
  const [email, setEmail] = useState("");

  function openMail() {
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
        "pna7702@gmail.com"
      )}`,
      "_blank"
    );
  }

  function validateEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function handleSubscribe() {
    if (!email) {
      return;
    }
    if (!validateEmail(email)) {
      return;
    }
    setEmail("");
  }

  return (
    <section className="relative">
      <div className="grid lg:grid-cols-2 gap-8 items-center">
        <div className="space-y-6">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold">
              {t("welcome")}
              <br />
            </h1>
            <h1 className="mt-2 font-bold">
              <span className="text-6xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Utopiosphere
              </span>
              <br />
              <span className="text-6xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mt-2 block">
                ユートピオスフィア
              </span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Tiếng Việt & English
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {t("description")}
            </p>
          </div>

          <div className="flex items-center space-x-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{t("location")}</span>
          </div>

          <div className="flex space-x-4 items-center">
            <Button variant="default" size="lg" onClick={openMail}>
              <Mail className="h-4 w-4 mr-2" />
              {t("contact")}
            </Button>
            <Button variant="outline" size="lg" onClick={handleSubscribe}>
              <Bell className="h-4 w-4 mr-2 text-blue-600" />
              {t("subscribe")}
            </Button>
            <div className="flex items-center space-x-2">
              <div className="flex items-center px-3 py-2 border rounded-md bg-background">
                <input
                  type="email"
                  className="bg-transparent outline-none text-base w-40"
                  placeholder={t("emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
