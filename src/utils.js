const AWS = require('aws-sdk');
const Apify = require('apify');

module.exports.hideTokenFromInput = (input) => {
    const newInput = { ...input, s3AccessKeyId: '******', s3SecretAccessKey: '******' };
    return newInput;
};

module.exports.setS3 = (credentials) => {
    const awsS3Params = {
        params: {
            Bucket: credentials.s3Bucket,
        },
        accessKeyId: credentials.s3AccessKeyId,
        secretAccessKey: credentials.s3SecretAccessKey,
    };

    const s3 = new AWS.S3(awsS3Params);
    return s3;
};

const loadItems = async ({ id, callback, batchSize, iterationInput, stats }, offset = 0, iterationIndex = 0) => {
    let newItems;
    const limit = batchSize;

    console.log('loading from dataset');
    newItems = await Apify.client.datasets.getItems({
        datasetId: id,
        offset,
        limit,
    }).then((res) => res.items).catch(console.log);

    if (!newItems || newItems.length === 0) {
        return;
    }
    await callback(newItems, iterationInput, iterationIndex, stats);
    newItems = null;
    await loadItems({ id, callback, batchSize, iterationInput, stats }, offset + limit, iterationIndex + 1);
};

module.exports.loadItems = loadItems;

const copyStoreFromRun = async (oldRunId) => {
    const { defaultKeyValueStoreId } = await Apify.client.acts.getRun({ runId: oldRunId, actId: process.env.APIFY_ACTOR_ID || 'SEQBnEA5oe2R9Hgdj' });
    const keys = await Apify.client.keyValueStores.listKeys({ storeId: defaultKeyValueStoreId })
        .then((res) => res.items.map((keyObj) => keyObj.key));
    const store = await Apify.openKeyValueStore();
    for (const key of keys) {
        console.log('Copying key to the current store:', key);
        const data = await Apify.client.keyValueStores.getRecord({ storeId: defaultKeyValueStoreId, key }).then((res) => res.body);
        await store.setValue(key, data);
    }
};

module.exports.copyStoreFromRun = copyStoreFromRun;

/*
module.exports.getObjectWithAllKeysFromS3 = async (s3, domain) => {
    const objectWithAllKeys = {};
    let lastKey = null;
    while (true) {
        const payload = { Prefix: domain, Marker: lastKey };
        console.dir(payload);
        const response = await s3.listObjects(payload).promise();
        const keys = response.Contents.map((item) => item.Key);
        console.log(`loaded ${keys.length} keys from S3`);
        if (keys.length === 0) {
            console.log(`loaded total ${Object.keys(objectWithAllKeys).length} keys from S3`);
            return objectWithAllKeys;
        }
        keys.forEach((key) => {
            objectWithAllKeys[key] = true;
        });
        lastKey = keys[keys.length - 1];
    }
};
*/
