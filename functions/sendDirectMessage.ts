import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default async function handler(req) {
    const base44 = createClientFromRequest(req);
    const { recipientId, content } = await req.json();

    if (!recipientId || !content) {
        return Response.json({ error: "Missing parameters" }, { status: 400 });
    }

    try {
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        // Find or create conversation
        let conversationId;
        const allConvos = await base44.asServiceRole.entities.Conversation.list();
        let conversation = allConvos.find(c => 
            c.participants.includes(user.id) && 
            c.participants.includes(recipientId)
        );

        if (!conversation) {
            conversation = await base44.asServiceRole.entities.Conversation.create({
                participants: [user.id, recipientId],
                last_message_at: new Date().toISOString(),
                last_message_preview: content.substring(0, 50)
            });
        } else {
            await base44.asServiceRole.entities.Conversation.update(conversation.id, {
                last_message_at: new Date().toISOString(),
                last_message_preview: content.substring(0, 50)
            });
        }
        conversationId = conversation.id;

        // Create message
        const message = await base44.asServiceRole.entities.DirectMessage.create({
            conversation_id: conversationId,
            sender_id: user.id,
            content: content,
            read: false,
            created_at: new Date().toISOString()
        });

        // Notify recipient
        await base44.asServiceRole.entities.Notification.create({
            recipient_id: recipientId,
            type: 'message',
            sender_id: user.id,
            title: `Message de ${user.username || user.full_name}`,
            message: content.substring(0, 50),
            link: `/Messages?conversationId=${conversationId}`,
            read: false
        });

        return Response.json({ success: true, message });
    } catch (error) {
        console.error(error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}

Deno.serve(handler);