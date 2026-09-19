import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ocean 3D Visualization Platform — PS 26067",
  description:
    "SIH 2026 prototype: interactive 3D ocean model + observation visualization (INCOIS).",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
