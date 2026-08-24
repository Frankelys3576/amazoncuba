// Every bigint id/FK in the DB (stores, products, orders, ...) comes back
// from Prisma as a JS BigInt; JSON.stringify can't serialize BigInt without
// this shim.
//
// M4: this used to live only in main.ts, imported for its side effect but
// never exercised by any test — main.ts's serverless `handler` isn't invoked
// in the test suite, so deleting the shim entirely still left the whole
// suite green while production would 500 on nearly every endpoint that
// returns a bigint. Moved here and imported by AppModule (which every e2e
// spec instantiates via Test.createTestingModule) so it actually runs
// before any test that exercises it, and given a dedicated e2e spec (see
// test/app.e2e-spec.ts) so a future regression fails loudly in CI instead
// of only in production.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function () {
  return Number(this);
};
