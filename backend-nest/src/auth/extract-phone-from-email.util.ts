// Extracts the phone-number local-part Express derives from an
// @cubaamazon.com login email (e.g. '5551234@cubaamazon.com' -> '5551234').
// This one function decides which store a bearer token maps to across two
// independent call sites — AuthService.login (which store to return on
// login) and SellerAuthStrategy.validate (which store every guarded seller
// route authorizes against). Kept as a single shared util, not duplicated,
// so those two can never silently drift into an authz divergence.
export const extractPhoneFromEmail = (email: string): string =>
  email.split('@')[0].replace(/\+/g, '').replace(/\s/g, '');
