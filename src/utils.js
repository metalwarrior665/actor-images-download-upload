const AWS = require('aws-sdk');
const Apify = require('apify');
const Jimp = require('jimp');

const { MINIMAL_HEIGHT, MINIMAL_WIDTH } = require('./constants');

module.exports.checkIfImage = async (buffer, skipImageCheck) => {
    if (skipImageCheck) {
        return {
            isImage: true,
            error: null,
        };
    }
    try {
        const metadata = await Jimp.read(buffer);
        const { width, height } = metadata.bitmap;
        if (width >= MINIMAL_WIDTH && height >= MINIMAL_HEIGHT) {
            return {
                isImage: true,
                error: null,
            };
        }
        return {
            isImage: false,
            error: 'Image is too small.',
        };
    } catch (e) {
        return {
            isImage: false,
            error: `Image could not be parsed. Error: ${e.message}`,
        };
    }
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

module.exports.loadItems = async (id, offset, items, type) => {
    let newItems;
    if (type === 'dataset') {
        console.log('loading from dataset');
        newItems = await Apify.client.datasets.getItems({
            datasetId: id,
            offset,
            limit: 100000,
        }).catch(console.log);
    } else if (type === 'crawler') {
        console.log('loading from crawler');
        newItems = await Apify.client.crawlers.getExecutionResults({
            executionId: id,
            simplified: 1,
            skipFailedPages: 1,
            offset,
            limit: 100000,
        }).catch(console.log);
    }
    if (!newItems || !newItems.items || newItems.items.length === 0) return items;
    items = items.concat(newItems.items);
    return module.exports.loadItems(id, offset + 100000, items, type);
};
