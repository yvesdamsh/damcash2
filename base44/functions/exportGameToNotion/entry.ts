import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Authentication Check
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse Input
        const { gameId } = await req.json();
        if (!gameId) {
            return Response.json({ error: 'Game ID is required' }, { status: 400 });
        }

        // 3. Get Game Data
        const game = await base44.entities.Game.get(gameId);
        if (!game) {
            return Response.json({ error: 'Game not found' }, { status: 404 });
        }

        // 4. Get Notion Token
        const accessToken = await base44.asServiceRole.connectors.getAccessToken("notion");
        if (!accessToken) {
            return Response.json({ error: 'Notion integration not connected' }, { status: 400 });
        }

        // 5. Find a parent page to add content to
        // We search for a page that is accessible to the integration
        const searchResponse = await fetch('https://api.notion.com/v1/search', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filter: {
                    value: 'page',
                    property: 'object'
                },
                sort: {
                    direction: 'descending',
                    timestamp: 'last_edited_time'
                },
                page_size: 1
            })
        });

        const searchData = await searchResponse.json();
        
        if (!searchData.results || searchData.results.length === 0) {
            return Response.json({ 
                error: 'No accessible Notion pages found. Please ensure you have shared a page with the integration.' 
            }, { status: 400 });
        }

        const parentPageId = searchData.results[0].id;

        // 6. Create the Page
        const isWhite = game.white_player_id === user.id;
        const opponentName = isWhite ? game.black_player_name : game.white_player_name;
        const myColor = isWhite ? "Blancs" : "Noirs";
        const outcome = game.winner_id === user.id ? "Victoire 🏆" : (game.winner_id ? "Défaite ❌" : "Nul 🤝");
        const dateStr = new Date(game.updated_date).toLocaleDateString('fr-FR');
        const gameUrl = `https://${new URL(req.url).host}/Game?id=${game.id}`;

        const createResponse = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                parent: { page_id: parentPageId },
                icon: { type: "emoji", emoji: "♟️" },
                cover: {
                    type: "external",
                    external: { url: "https://images.unsplash.com/photo-1586165368502-1bad197a6461?w=1200&q=80" }
                },
                properties: {
                    title: {
                        title: [
                            { text: { content: `Analyse: vs ${opponentName || 'Adversaire'}` } }
                        ]
                    }
                },
                children: [
                    {
                        object: 'block',
                        type: 'callout',
                        callout: {
                            rich_text: [{ text: { content: `Résumé du Match - ${dateStr}` } }],
                            icon: { emoji: "📝" },
                            color: "gray_background"
                        }
                    },
                    {
                        object: 'block',
                        type: 'table',
                        table: {
                            table_width: 2,
                            has_column_header: false,
                            has_row_header: true,
                            children: [
                                {
                                    type: "table_row",
                                    table_row: { cells: [[{ text: { content: "Jeu" } }], [{ text: { content: game.game_type.toUpperCase() } }]] }
                                },
                                {
                                    type: "table_row",
                                    table_row: { cells: [[{ text: { content: "Adversaire" } }], [{ text: { content: opponentName || "Inconnu" } }]] }
                                },
                                {
                                    type: "table_row",
                                    table_row: { cells: [[{ text: { content: "Ma Couleur" } }], [{ text: { content: myColor } }]] }
                                },
                                {
                                    type: "table_row",
                                    table_row: { cells: [[{ text: { content: "Résultat" } }], [{ text: { content: outcome } }]] }
                                }
                            ]
                        }
                    },
                    {
                        object: 'block',
                        type: 'heading_2',
                        heading_2: { rich_text: [{ text: { content: "Historique des Coups" } }] }
                    },
                    {
                        object: 'block',
                        type: 'code',
                        code: {
                            caption: [],
                            rich_text: [{ text: { content: game.moves || "Aucun coup enregistré." } }],
                            language: "plain text"
                        }
                    },
                    {
                        object: 'block',
                        type: 'paragraph',
                        paragraph: {
                            rich_text: [
                                { text: { content: "Voir le replay sur DamCash", link: { url: gameUrl } } }
                            ]
                        }
                    }
                ]
            })
        });

        if (!createResponse.ok) {
            const errorData = await createResponse.text();
            console.error("Notion API Error:", errorData);
            return Response.json({ error: 'Failed to create Notion page', details: errorData }, { status: 500 });
        }

        const pageData = await createResponse.json();
        return Response.json({ success: true, url: pageData.url });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});