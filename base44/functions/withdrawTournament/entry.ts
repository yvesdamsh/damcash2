import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default async function handler(req) {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return new Response("Unauthorized", { status: 401 });

    try {
        const { tournamentId } = await req.json();
        if (!tournamentId) return Response.json({ error: "Missing tournamentId" }, { status: 400 });

        const tournament = await base44.asServiceRole.entities.Tournament.get(tournamentId);
        if (!tournament) return Response.json({ error: "Tournament not found" }, { status: 404 });

        // Find participant record for this user
        // Note: In team mode, user_id is the leader who registered the team
        const participants = await base44.asServiceRole.entities.TournamentParticipant.filter({
            tournament_id: tournamentId,
            user_id: user.id
        });
        
        const participant = participants[0];
        if (!participant) return Response.json({ error: "Not a participant" }, { status: 400 });

        // Case 1: Tournament Open -> Refund & Delete
        if (tournament.status === 'open') {
            if (tournament.entry_fee > 0) {
                 // Refund Logic
                 const wallets = await base44.asServiceRole.entities.Wallet.filter({ user_id: user.id });
                 let wallet = wallets[0];
                 if (!wallet) wallet = await base44.asServiceRole.entities.Wallet.create({ user_id: user.id, balance: 0 });

                 await base44.asServiceRole.entities.Wallet.update(wallet.id, {
                     balance: (wallet.balance || 0) + tournament.entry_fee
                 });

                 await base44.asServiceRole.entities.Transaction.create({
                     user_id: user.id,
                     type: 'refund',
                     amount: tournament.entry_fee,
                     game_id: tournament.id,
                     status: 'completed',
                     description: `Remboursement inscription tournoi ${tournament.name}`
                 });
            }

            // Remove participant
            await base44.asServiceRole.entities.TournamentParticipant.delete(participant.id);
            
            return Response.json({ success: true, message: "Inscription annulée et remboursée" });
        } 
        // Case 2: Tournament Ongoing -> Mark Withdrawn
        else if (tournament.status === 'ongoing') {
            await base44.asServiceRole.entities.TournamentParticipant.update(participant.id, {
                status: 'withdrawn'
            });
            
            // If they have an active game, force resign it?
            // This is complex as it involves game logic (ELO, etc). 
            // For now, we just mark them withdrawn from tournament. 
            // The pairing system (Swiss/Arena) should skip withdrawn players.
            // Existing games will likely timeout or user can resign them manually.

            return Response.json({ success: true, message: "Vous avez quitté le tournoi" });
        } 
        else {
            return Response.json({ error: "Le tournoi est terminé" }, { status: 400 });
        }
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

Deno.serve(handler);