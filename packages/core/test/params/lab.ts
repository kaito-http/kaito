import {create} from '../../src/index.ts';

const router = create();

const guildChannelRouter = router
	.params<'guild_id' | 'channel_id'>()
	.get('/', ({params}) => ({
		guild: params.guild_id,
		channel: params.channel_id,
	}));

const guildRouter = router
	.params<'guild_id'>()
	.merge('/channels/:channel_id', guildChannelRouter);

const app = router.merge('/guilds/:guild_id', guildRouter);

app.serve();
