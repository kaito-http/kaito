import {Router} from './router/router.ts';

export * from './config.ts';
export * from './error.ts';
export * from './head.ts';
export * from './request.ts';
export * from './route.ts';
export * from './router/router.ts';
export * from './schema/schema.ts';
export * from './util.ts';

/**
 * Helper function for instantiating a Kaito router
 *
 * This is the starting point for any Kaito application
 *
 * @param config - The configuration for the router
 * @returns A new Kaito router
 */
export const create = Router.create;
