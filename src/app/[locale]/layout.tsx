import "../../styles/global.css";
import { Inter } from "next/font/google";
import { Header } from "../../components/header";
import { Providers } from "@/src/context/providers";
import { Language } from "@/src/components/enums";

const inter = Inter({ subsets: ["latin"] });

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { locale: Language };
}) {
  const { locale } = await params;
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className}>
        <Providers locale={locale}>
          <div className="min-h-screen bg-background px-16">
            <Header />
            <div className="mx-auto flex items-center justify-center">
              <div className="container px-4 py-8">{children}</div>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
