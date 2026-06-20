export interface SiteConfig {
  locale: string;
  currency: string;
  price: string;
  checkoutUrl: string;
  firstButtonText: string;
  purchaseButtonText: string;
}

export const DEFAULT_CONFIG: SiteConfig = {
  locale: "fr-FR",
  currency: "EUR",
  price: "€2,99",
  checkoutUrl: "https://eaglemedia.mycartpanda.com/checkout/210148860:1",
  firstButtonText: "COMMENCER",
  purchaseButtonText: "RECEVOIR MA VIGNETTE",
};
