import { mutation, query, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';

export const EMOJI_OPTIONS = ['🔥', '😲', '👏', '💯', '🤔', '😂', '😍', '🤯'] as const;

const TTL_MS = 5_000;
const RATE_LIMIT_MS = 1_000; // una reacción por segundo por jugador

export const send = mutation({
  args: {
    roomId: v.id('rooms'),
    clientId: v.string(),
    playerName: v.string(),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    if (!(EMOJI_OPTIONS as readonly string[]).includes(args.emoji)) return;

    // Rate limiting: verificar última reacción del jugador
    const recent = await ctx.db
      .query('liveReactions')
      .withIndex('by_room', q => q.eq('roomId', args.roomId))
      .filter(q => q.eq(q.field('clientId'), args.clientId))
      .order('desc')
      .first();

    if (recent && Date.now() - recent.sentAt < RATE_LIMIT_MS) return;

    const id = await ctx.db.insert('liveReactions', {
      roomId: args.roomId,
      clientId: args.clientId,
      playerName: args.playerName,
      emoji: args.emoji,
      sentAt: Date.now(),
    });

    await ctx.scheduler.runAfter(TTL_MS, internal.liveReactions._cleanup, { id });
  },
});

export const list = query({
  args: { roomId: v.id('rooms') },
  handler: async (ctx, args) => {
    return ctx.db
      .query('liveReactions')
      .withIndex('by_room', q => q.eq('roomId', args.roomId))
      .collect();
  },
});

export const _cleanup = internalMutation({
  args: { id: v.id('liveReactions') },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (doc) await ctx.db.delete(args.id);
  },
});
