const Apify = require('apify');

module.exports = {
    PROXY_URL: Apify.getApifyProxyUrl(),
};
