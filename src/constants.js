const Apify = require('apify');

module.exports = {
    PROXY_URL: Apify.getApifyProxyUrl(),
    REQUEST_INTERNAL_TIMEOUT: 6000,
    REQUEST_EXTERNAL_TIMEOUT: 7000,
    DATASET_BATCH_SIZE: 5000,
};
