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
  checkoutUrl: "https://buy.stripe.com/5kQ3cvcFZ01P4VTb2v5Vu09",
  firstButtonText: "COMMENCER",
  purchaseButtonText: "RECEVOIR MA VIGNETTE",
};
