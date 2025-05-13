import {create} from '../../src/index.ts';

const router = create();

const guildChannelRouter = router
	.params({
		guild_id: k.string(),
		channel_id: k.string(),
	})
	.get('/', ({params}) => ({
		guild: params.guild_id,
		channel: params.channel_id,
	}));

const guildRouter = router
	.params({
		guild_id: k.string(),
	})
	.merge('/channels/:channel_id', guildChannelRouter);

const app = router.merge('/guilds/:guild_id', guildRouter);

app.serve();
