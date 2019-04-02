const Apify = require('apify');

module.exports = {
    PROXY_URL: Apify.getApifyProxyUrl(),
    REQUEST_EXTERNAL_TIMEOUT: 7000,
    DATASET_BATCH_SIZE: 10000,
};
