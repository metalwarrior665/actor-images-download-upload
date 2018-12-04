const rp = require('request-fixed-tunnel-agent');
const Apify = require('apify');

Apify.main(async () => {
    const response = await rp({
        url: 'https://cdn.laredoute.com/products/7/d/c/7dcb0dsfsdf27110a461bc1d611d905122b07.jpg',
        resolveWithFullResponse: true,
    });
    await Apify.setValue('res', response.body, {contentType: 'text/html'});
    console.log(typeof response.statusCode);
});
