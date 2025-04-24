const { expect } = require('chai');

describe('core/env singleton', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => { process.env = { ...ORIGINAL_ENV }; delete require.cache[require.resolve('../../core/env')]; });

  it('exports a frozen object when all vars present', () => {
    process.env.TG_TOKEN      = 'TEST_TOKEN';
    process.env.DATABASE_URL  = 'postgres://user@host/db';
    process.env.FORM_URL      = 'https://example.com';
    const cfg = require('../../core/env');
    expect(cfg).to.be.frozen;
    expect(cfg.tgToken).to.equal('TEST_TOKEN');
  });

  it('throws when a variable is missing', () => {
    process.env.TG_TOKEN     = 'x';          // omit DATABASE_URL
    process.env.FORM_URL     = 'x';
    expect(() => require('../../core/env'))
      .to.throw(/Missing required env vars.*DATABASE_URL/);
  });
});
