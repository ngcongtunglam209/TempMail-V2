// LamMail API — message routes

import provider from '../providers/index.js';
import { requireMailbox } from './_auth.js';

export default async function messageRoutes(app) {
  app.get('/v1/messages', { preHandler: requireMailbox }, async (req) => {
    return provider.listMessages(req.mailbox);
  });

  app.get('/v1/messages/:id', { preHandler: requireMailbox }, async (req, reply) => {
    const msg = await provider.getMessage(req.mailbox, req.params.id);
    if (!msg) {
      reply.code(404);
      return { error: 'Message not found' };
    }
    return msg;
  });

  app.get(
    '/v1/messages/:id/attachments/:attachmentId',
    { preHandler: requireMailbox },
    async (req, reply) => {
      const att = await provider.getAttachment(
        req.mailbox,
        req.params.id,
        req.params.attachmentId,
      );
      if (!att) {
        reply.code(404);
        return { error: 'Attachment not found' };
      }
      reply
        .header('Content-Type', att.content_type || 'application/octet-stream')
        .header(
          'Content-Disposition',
          `attachment; filename="${(att.filename || 'attachment').replace(/"/g, '')}"`,
        );
      return att.data;
    },
  );

  app.delete('/v1/messages/:id', { preHandler: requireMailbox }, async (req, reply) => {
    const ok = await provider.deleteMessage(req.mailbox, req.params.id);
    if (!ok) {
      reply.code(404);
      return { error: 'Message not found' };
    }
    reply.code(204);
    return null;
  });

  app.delete('/v1/messages', { preHandler: requireMailbox }, async (req) => {
    const removed = await provider.deleteAllMessages(req.mailbox);
    return { removed };
  });
}
