import { captureForcedServerError, initServerSentry } from '../index';

initServerSentry();
const err = captureForcedServerError();

console.log(`Captured forced server error for Sentry validation: ${err.message}`);
