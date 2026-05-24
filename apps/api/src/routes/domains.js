// LamMail API — domains route

import provider from '../providers/index.js';

export default async function domainRoutes(app) {
  app.get('/v1/domains', async () => {
    const list = await provider.domains();
    return list;
  });
}
