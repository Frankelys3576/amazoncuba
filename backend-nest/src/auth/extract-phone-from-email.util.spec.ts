import { extractPhoneFromEmail } from './extract-phone-from-email.util';

describe('extractPhoneFromEmail', () => {
  it('extracts the local-part of an @cubaamazon.com email as the phone', () => {
    expect(extractPhoneFromEmail('5551234@cubaamazon.com')).toBe('5551234');
  });

  it('strips a leading + and any spaces from the local-part', () => {
    expect(extractPhoneFromEmail('+53 5551234@cubaamazon.com')).toBe(
      '535551234',
    );
  });
});
