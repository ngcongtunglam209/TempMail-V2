// LamMail API — provider selector
// Reads CONFIG.provider and re-exports the chosen adapter.

import CONFIG from '../config.js';
import local from './local.js';
import upstream from './upstream.js';

const providers = {
  local,
  upstream,
};

const provider = providers[CONFIG.provider];
if (!provider) {
  throw new Error(
    `Unknown PROVIDER "${CONFIG.provider}". Expected one of: ${Object.keys(providers).join(', ')}`,
  );
}

export default provider;
