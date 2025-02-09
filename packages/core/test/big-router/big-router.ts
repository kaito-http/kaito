import {mountMe} from './mount-me.ts';
import {router} from './router.ts';

export const bigrouter = router.merge(
		'/8',
		mountMe.get('/test-8', () => 8),
	)
	.merge(
		'/9',
		mountMe.get('/test-9', () => 9),
	)
	.merge(
		'/10',
		mountMe.get('/1test-0', () => 10),
	)
	.merge(
		'/11',
		mountMe.get('/1test-1', () => 11),
	)
	.merge(
		'/12',
		mountMe.get('/1test-2', () => 12),
	)
	.merge(
		'/13',
		mountMe.get('/1test-3', () => 13),
	)
	.merge(
		'/14',
		mountMe.get('/1test-4', () => 14),
	)
	.get('/43', () => 43)
	.get('/44', () => 44)
	.get('/45', () => 45)
	.get('/46', () => 46)
	.get('/47', () => 47)
	.get('/48', () => 48)
	.get('/49', () => 49)
	.get('/50', () => 50);
