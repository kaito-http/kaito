import {create} from '../../src/index.ts';
import {z} from 'zod';

const router = create();

const guildChannelRouter = router
	.params({
		guild_id: z.string(),
		channel_id: z.string(),
	})
	.get('/', ({params}) => ({
		guild: params.guild_id,
		channel: params.channel_id,
	}));

const guildRouter = router
	.params({
		guild_id: z.string(),
	})
	.merge('/channels/:channel_id', guildChannelRouter);

const app = router.merge('/guilds/:guild_id', guildRouter);

app.serve();
