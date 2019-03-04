const AWS = require('aws-sdk');
const Apify = require('apify');
const imageSize = require('image-size');
const fileType = require('file-type');
const webp = require('webp-converter');
const fs = require('fs');
const { promisify } = require('util');

const { DATASET_BATCH_SIZE } = require('constants');

const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);

const converter = (input, output, option) => new Promise((res, rej) => {
    webp.dwebp(input, output, option, (status, err) => {
        if (status === '101') {
            rej(err);
        } else if (status === '100') {
            res(status);
        } else {
            rej(new Error(`Unknown status: ${status}, Error: ${err}`));
        }
    });
});

module.exports.convertWebpToPng = async (origBuffer, key) => {
    // sanitize key for slashes
    const folders = key.split('/');
    const sanitizedKey = folders[folders.length - 1];
    const webpKey = `${sanitizedKey}.webp`;
    const pngKey = `${sanitizedKey}.png`;
    await writeFileAsync(webpKey, origBuffer);
    await converter(webpKey, pngKey, '-o');
    return readFileAsync(pngKey);
};


module.exports.hideTokenFromInput = (input) => {
    const newInput = { ...input, s3AccessKeyId: '******', s3SecretAccessKey: '******' };
    return newInput;
};

module.exports.checkIfImage = async (response, imageCheck) => {
    try {
        if (!response) {
            return {
                isImage: false,
                error: 'No response object, probably crashed',
                retry: false,
            };
        }

        const { statusCode } = response;

        if (statusCode === 404) {
            return {
                isImage: false,
                error: statusCode,
                retry: false,
            };
        }
        if (statusCode >= 400) {
            return {
                isImage: false,
                error: statusCode,
                retry: true,
            };
        }

        const buffer = response.body;
        let contentType;

        if (imageCheck.type === 'content-type' || imageCheck.type === 'image-size') {
            const { mime } = fileType(buffer);
            contentType = mime;
            if (!mime.includes('image/')) {
                return {
                    isImage: false,
                    error: `Content type is not an image. Instead: ${mime}`,
                    retry: true,
                };
            }
        }

        // first we check buffer size
        const imageSizeInKB = Math.floor(buffer.length / 1024);
        if (imageSizeInKB < imageCheck.minSize) {
            return {
                isImage: false,
                error: `Image is too small. Actual size: ${imageSizeInKB}, min size: ${imageCheck.minSize}`,
                retry: false,
            };
        }

        if (imageCheck.type === 'image-size') {
            const { width, height } = imageSize(buffer);
            if (width < imageCheck.minWidth || height < imageCheck.minHeight) {
                return {
                    isImage: false,
                    error: `Image width or height is too small. Actual: width: ${width}, height: ${height}. Minimum: width: ${imageCheck.minWidth}, height: ${imageCheck.minHeight} `,  // eslint-disable-line
                    retry: false,
                };
            }
        }
        return {
            isImage: true,
            error: null,
            contentType,
        };
    } catch (e) {
        return {
            isImage: false,
            error: `Image check crashed. Error: ${e}`,
            retry: false,
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

const loadItems = async ({ id, type, callback }, offset = 0, items = [], iterationIndex = 0) => {
    let newItems;
    const limit = DATASET_BATCH_SIZE;
    if (type === 'dataset') {
        console.log('loading from dataset');
        newItems = await Apify.client.datasets.getItems({
            datasetId: id,
            offset,
            limit,
        }).then((res) => res.items).catch(console.log);
    } else if (type === 'crawler') {
        console.log('loading from crawler');
        newItems = await Apify.client.crawlers.getExecutionResults({
            executionId: id,
            simplified: 1,
            skipFailedPages: 1,
            offset,
            limit,
        }).then((res) => res.items).catch(console.log);
    }
    if (!newItems || newItems.length === 0) return;
    await callback(newItems, iterationIndex);
    await loadItems({ id, type, callback }, offset + limit, items, iterationIndex + 1);
};

module.exports.loadItems = loadItems;
