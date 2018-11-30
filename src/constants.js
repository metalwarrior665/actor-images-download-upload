const Apify = require('apify');

module.exports = {
    PROXY_URL: Apify.getApifyProxyUrl(),
    MINIMAL_WIDTH: 100,
    MINIMAL_HEIGHT: 100,
};
