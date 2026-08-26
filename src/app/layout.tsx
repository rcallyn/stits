import type { Metadata } from "next";
import Nav from "@/components/Nav";
import SearchPalette from "@/components/SearchPalette";
import "./globals.css";

export const metadata: Metadata = {
  title: "stits",
  description: "Schedule, todos, and everything else in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('stits:theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Nav />
        <div className="flex flex-1 flex-col pb-16 md:pb-0">{children}</div>
        <SearchPalette />
      </body>
    </html>
  );
}
