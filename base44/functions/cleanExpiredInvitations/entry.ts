import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Admin/service-only task: ensure requester is admin if called interactively
    const me = await base44.auth.me().catch(() => null);
    if (me && me.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = Date.now();
    const pending = await base44.asServiceRole.entities.Invitation.filter({ status: 'pending' }, '-created_date', 500);

    let cleaned = 0;
    for (const inv of pending) {
      const created = inv.created_date ? new Date(inv.created_date).getTime() : 0;
      if (created && (now - created) > 60_000) {
        await base44.asServiceRole.entities.Invitation.update(inv.id, { status: 'declined' });
        cleaned++;
      }
    }

    return Response.json({ cleaned });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});