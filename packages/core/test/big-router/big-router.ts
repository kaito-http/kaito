import {mountMe} from './mount-me.ts';
import {router} from './router.ts';

export const bigrouter = router()
	.merge(
		'/8',
		mountMe.get('/test-8', async () => 8),
	)
	.merge(
		'/9',
		mountMe.get('/test-9', async () => 9),
	)
	.merge(
		'/10',
		mountMe.get('/1test-0', async () => 10),
	)
	.merge(
		'/11',
		mountMe.get('/1test-1', async () => 11),
	)
	.merge(
		'/12',
		mountMe.get('/1test-2', async () => 12),
	)
	.merge(
		'/13',
		mountMe.get('/1test-3', async () => 13),
	)
	.merge(
		'/14',
		mountMe.get('/1test-4', async () => 14),
	)
	.get('/43', async () => 43)
	.get('/44', async () => 44)
	.get('/45', async () => 45)
	.get('/46', async () => 46)
	.get('/47', async () => 47)
	.get('/48', async () => 48)
	.get('/49', async () => 49)
	.get('/50', async () => 50);
