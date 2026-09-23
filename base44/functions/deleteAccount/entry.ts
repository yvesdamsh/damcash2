import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default async function handler(req) {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Delete user data (Optional: delete related entities if needed, but cascading might not be automatic)
        // For now, just delete the User record.
        // Note: This deletes the record in 'User' entity. Auth provider deletion might be separate but this disables the user in the app.
        
        await base44.asServiceRole.entities.User.delete(user.id);
        
        // You might want to delete their games, notifications etc. or keep them as "Deleted User"
        // Keeping data is usually safer for integrity of games played against others.

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

Deno.serve(handler);