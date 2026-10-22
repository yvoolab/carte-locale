import "./globals.css";

export const metadata = {
  title: "Carte Locale",
  description: "What your street likes, turned into a week of menu, playlist, shelf and event ideas. Built on Qloo's taste graph.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
