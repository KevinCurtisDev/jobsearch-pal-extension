// Brand strings (ADR-011). In hand-written source the brand name, store title and domain appear only
// here and in _locales/en/messages.json. The name itself comes from extension.config.json via PRODUCT.
import { PRODUCT } from "../shared/product";

export const BRAND_NAME: string = PRODUCT.name;
export const STORE_TITLE = `${BRAND_NAME}: Job Application Tracker`;
export const PLATFORM_DOMAIN = "jobsearchpal.com";
