import { extractBearerToken } from './bearer-token.util';

describe('extractBearerToken', () => {
  it('devuelve el token de una cabecera Bearer bien formada', () => {
    expect(extractBearerToken('Bearer abc')).toBe('abc');
    expect(extractBearerToken('bearer abc')).toBe('abc');
    expect(extractBearerToken('  Bearer   abc  ')).toBe('abc');
  });

  it('devuelve null para cabeceras ausentes o malformadas', () => {
    // "Bearer" a secas es el caso que abría el agujero: split(' ')[1] daba
    // undefined y getUser(undefined) recae en la sesión guardada del cliente
    // compartido en vez de fallar.
    expect(extractBearerToken('Bearer')).toBeNull();
    expect(extractBearerToken('Bearer ')).toBeNull();
    expect(extractBearerToken('')).toBeNull();
    expect(extractBearerToken('   ')).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken(['Bearer abc'])).toBeNull();
    expect(extractBearerToken('Basic abc')).toBeNull();
    expect(extractBearerToken('abc')).toBeNull();
    expect(extractBearerToken('Bearer a b')).toBeNull();
  });
});
