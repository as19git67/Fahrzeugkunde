import type { Metadata } from "next";
import "./globals.css";
import { BuildInfoFooter } from "@/components/BuildInfoFooter";

export const metadata: Metadata = {
  title: "Fahrzeugkunde – Feuerwehr Lernspiel",
  description: "Lerne spielerisch, wo welche Ausrüstung im Feuerwehrauto verstaut ist.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-zinc-950">
        <div className="flex-1 flex flex-col">{children}</div>
        <BuildInfoFooter />
      </body>
    </html>
  );
}
