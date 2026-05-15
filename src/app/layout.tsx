import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ta Vignette Panini de la Coupe du Monde 2026 | Créer maintenant",
  description:
    "Crée ta vignette Panini personnalisée de la Coupe du Monde 2026 ! Ta photo avec le style des champions. Fichier numérique pour seulement €2,99.",
  robots: "index, follow",
  openGraph: {
    title: "Ta Vignette Panini de la Coupe du Monde 2026",
    description: "Crée ta vignette Panini personnalisée de la Coupe du Monde 2026 !",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap" rel="stylesheet" />
        <script type="text/javascript" src="https://assets.mycartpanda.com/cartx-ecomm-ui-assets/js/cpsales.js"></script>
      </head>
      <body className="min-h-full flex flex-col">
        <Script
          id="utmify-utms"
          src="https://cdn.utmify.com.br/scripts/utms/latest.js"
          data-utmify-prevent-xcod-sck=""
          data-utmify-prevent-subids=""
          data-utmify-ignore-iframe=""
          data-utmify-is-cartpanda=""
          strategy="afterInteractive"
        />
        <Script id="utmify-pixel" strategy="afterInteractive">{`
          window.pixelId = "6a0653073ac32b2418844574";
          var a = document.createElement("script");
          a.setAttribute("async", "");
          a.setAttribute("defer", "");
          a.setAttribute("src", "https://cdn.utmify.com.br/scripts/pixel/pixel.js");
          document.head.appendChild(a);
        `}</Script>
        <Script id="hide-cartpanda" strategy="afterInteractive">{`
          function hideCpd(el) {
            if (!el || !el.className) return;
            var cls = typeof el.className === 'string' ? el.className : '';
            if (cls.indexOf('cpd-') !== -1) { el.style.setProperty('display','none','important'); }
          }
          document.querySelectorAll('[class*="cpd-"]').forEach(hideCpd);
          var obs = new MutationObserver(function(mutations) {
            mutations.forEach(function(m) {
              m.addedNodes.forEach(function(n) {
                if (n.nodeType === 1) {
                  hideCpd(n);
                  n.querySelectorAll && n.querySelectorAll('[class*="cpd-"]').forEach(hideCpd);
                }
              });
            });
          });
          obs.observe(document.body, { childList: true, subtree: true });
        `}</Script>
        {children}
      </body>
    </html>
  );
}
