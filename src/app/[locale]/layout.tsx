import { Inter, Noto_Serif_SC } from "next/font/google";
import { Header } from "../../components/header";
import { Providers } from "@/src/context/providers";
import { FloatingMusicBox } from "@/src/components/music/FloatingMusicBox";
import { Language } from "@/src/components/enums";

const inter = Inter({ subsets: ["latin"] });

const notoSerifSC = Noto_Serif_SC({
  weight: ["400", "700"],
  variable: "--font-noto-serif-sc",
  display: "swap",
  preload: false,
});

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { locale: Language };
}) {
  const { locale } = await params;
  return (
    <html lang={locale}>
      <body className={`${inter.className} ${notoSerifSC.variable}`}>
        <Providers locale={locale}>
          <div className="min-h-screen bg-background px-16">
            <Header />
            <div className="mx-auto flex items-center justify-center">
              <div className="container px-4 py-8">{children}</div>
            </div>
          </div>
          <FloatingMusicBox />
        </Providers>
      </body>
    </html>
  );
}
