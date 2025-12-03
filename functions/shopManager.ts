import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default async function handler(req) {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, productId } = await req.json();

    if (action === 'list_products') {
        const products = await base44.asServiceRole.entities.Product.filter({ is_active: true });
        const owned = await base44.asServiceRole.entities.UserItem.filter({ user_id: user.id });
        return Response.json({ products, owned: owned.map(i => i.product_id) });
    }

    if (action === 'buy') {
        if (!productId) return Response.json({ error: 'Missing productId' }, { status: 400 });

        // 1. Check Product
        const product = await base44.asServiceRole.entities.Product.get(productId);
        if (!product) return Response.json({ error: 'Produit introuvable' }, { status: 404 });

        // 2. Check if already owned
        const owned = await base44.asServiceRole.entities.UserItem.filter({ user_id: user.id, product_id: productId });
        if (owned.length > 0) return Response.json({ error: 'Déjà possédé' }, { status: 400 });

        // 3. Check Level
        if ((user.level || 1) < product.required_level) {
            return Response.json({ error: `Niveau ${product.required_level} requis` }, { status: 403 });
        }

        // 4. Check Funds
        const wallets = await base44.asServiceRole.entities.Wallet.filter({ user_id: user.id });
        const wallet = wallets[0];
        if (!wallet || (wallet.balance || 0) < product.price) {
            return Response.json({ error: 'Fonds insuffisants' }, { status: 400 });
        }

        // 5. Process Purchase
        await base44.asServiceRole.entities.Wallet.update(wallet.id, {
            balance: wallet.balance - product.price
        });

        await base44.asServiceRole.entities.Transaction.create({
            user_id: user.id,
            type: 'purchase',
            amount: -product.price,
            status: 'completed',
            description: `Achat: ${product.name}`,
            created_at: new Date().toISOString()
        });

        await base44.asServiceRole.entities.UserItem.create({
            user_id: user.id,
            product_id: product.id,
            product_type: product.type,
            price_paid: product.price,
            purchased_at: new Date().toISOString()
        });

        return Response.json({ success: true, message: 'Achat réussi !' });
    }

    if (action === 'equip') {
        const { productId, type } = await req.json(); // type: 'avatar' or 'theme'
        
        // Validate ownership
        const owned = await base44.asServiceRole.entities.UserItem.filter({ user_id: user.id, product_id: productId });
        if (owned.length === 0 && productId !== null) { // allow unequip (null)?
             // Check if it's a default item (if we had default items, but here assuming all non-null need check)
             return Response.json({ error: 'Non possédé' }, { status: 403 });
        }

        const updateData = {};
        if (type === 'avatar') updateData.active_avatar_id = productId;
        if (type === 'theme') updateData.active_theme_id = productId;
        
        await base44.asServiceRole.entities.User.update(user.id, updateData);
        
        // If avatar, also update avatar_url if product has one
        if (type === 'avatar') {
            const product = await base44.asServiceRole.entities.Product.get(productId);
            if (product && product.image_url) {
                await base44.asServiceRole.entities.User.update(user.id, { avatar_url: product.image_url });
            }
        }

        return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
}

Deno.serve(handler);