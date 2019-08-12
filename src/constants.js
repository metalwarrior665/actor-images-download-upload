const Apify = require('apify');

module.exports = {
    PROXY_URL: Apify.getApifyProxyUrl(),
    DEFAULT_REQUEST_EXTERNAL_TIMEOUT: 7000,
    DEFAULT_BATCH_SIZE: 10000,
};
