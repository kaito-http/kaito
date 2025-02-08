import {create} from '../../src/index.ts';

const router = create();

const guildChannelRouter = router.params<{guild_id: string; channel_id: string}>().get('/', ({params}) => ({
	guild: params.guild_id,
	channel: params.channel_id,
}));

const guildRouter = router.params<{guild_id: string}>().merge('/channels/:channel_id', guildChannelRouter);

const app = router.merge('/guilds/:guild_id', guildRouter);

app.serve();
