import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { z } from 'npm:zod@^3.24.2';

const sendMessageSchema = z.object({
    recipientId: z.string().min(1, "Recipient ID is required"),
    content: z.string().min(1, "Content is required").max(2000, "Content too long")
});

export default async function handler(req) {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    
    const validation = sendMessageSchema.safeParse(body);
    if (!validation.success) {
        return Response.json({ error: "Invalid input", details: validation.error.format() }, { status: 400 });
    }

    const { recipientId, content } = validation.data;

    try {
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        // Find or create conversation
        let conversationId;
        // Optimized filter
        // Note: Base44 might not support complex array intersection in filter, so we filter by one participant and check the other in code
        // This is much better than listing ALL conversations
        const userConvos = await base44.asServiceRole.entities.Conversation.filter({ 
            participants: { '$in': [user.id] } 
        });
        
        let conversation = userConvos.find(c => c.participants.includes(recipientId));

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

        // Notify recipient (Real-time)
        await base44.asServiceRole.functions.invoke('sendNotification', {
            recipient_id: recipientId,
            type: 'message',
            title: `Message de ${user.username || user.full_name}`,
            message: content.substring(0, 50),
            link: `/Messages?conversationId=${conversationId}`,
            sender_id: user.id,
            metadata: { conversationId }
        });

        return Response.json({ success: true, message });
    } catch (error) {
        console.error(error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}

Deno.serve(handler);