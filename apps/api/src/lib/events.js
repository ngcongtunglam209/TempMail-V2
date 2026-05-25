// LamMail API — singleton event bus
// Used to fan out inbound-message notifications to SSE subscribers without
// any I/O between the SMTP receiver and connected scripts.

import { EventEmitter } from 'node:events';

const bus = new EventEmitter();
// Plenty of room for many concurrent SSE clients.
bus.setMaxListeners(0);

export default bus;
