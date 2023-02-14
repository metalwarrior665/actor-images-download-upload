import { Actor, log } from 'apify';
import rp from 'request-fixed-tunnel-agent';

await Actor.init();

const response = await rp({
    url: 'https://cdn.laredoute.com/products/7/d/c/7dcb0dsfsdf27110a461bc1d611d905122b07.jpg',
    resolveWithFullResponse: true,
});
await Actor.setValue('res', response.body, { contentType: 'text/html' });
log.info(typeof response.statusCode);

await Actor.exit();