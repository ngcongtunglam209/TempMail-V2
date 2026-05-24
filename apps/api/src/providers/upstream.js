// LamMail API — upstream provider stub
// Mail.tm proxy. Filled in during Phase 2.

const stub = (name) => async () => {
  const err = new Error(`upstream provider: ${name} not implemented yet`);
  err.statusCode = 501;
  throw err;
};

export default {
  name: 'upstream',
  createAdminMailbox: stub('createAdminMailbox'),
  unlockMailbox: stub('unlockMailbox'),
  getMailboxByToken: stub('getMailboxByToken'),
  listMessages: stub('listMessages'),
  getMessage: stub('getMessage'),
  getAttachment: stub('getAttachment'),
  deleteMessage: stub('deleteMessage'),
  deleteAllMessages: stub('deleteAllMessages'),
  deleteMailbox: stub('deleteMailbox'),
  listMailboxesAdmin: stub('listMailboxesAdmin'),
  deleteMailboxByAddress: stub('deleteMailboxByAddress'),
  setPasscode: stub('setPasscode'),
  domains: stub('domains'),
  isAddressActive: async () => false,
};
