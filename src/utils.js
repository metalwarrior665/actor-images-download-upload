const AWS = require('aws-sdk');
const Apify = require('apify');
const imageSize = require('image-size');
const fileType = require('file-type');
const webp = require('webp-converter');
const fs = require('fs');
const { promisify } = require('util');

const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);

const converter = (input, output, option) => new Promise((res, rej) => {
    webp.dwebp(input, output, option, (status, err) => {
        if (err) {
            rej(err);
        } else {
            res(status)
        }
    })
})

module.exports.convertWebpToPng = async (origBuffer, key)=> {
    const webpKey = `${key}.webp`;
    const pngKey = `${key}.png`;
    await writeFileAsync(webpKey, origBuffer);
    await converter(webpKey, pngKey, '-o');
    return readFileAsync(pngKey);
}


module.exports.hideTokenFromInput = (input) => {
    const newInput = { ...input, s3AccessKeyId: '******', s3SecretAccessKey: '******' };
    return newInput;
};

module.exports.checkIfImage = async (response, imageCheck) => {
    try{
        if (!response) {
            return {
                isImage: false,
                error: `No response object, probably crashed`,
                retry: false,
            }
        }

        const { statusCode } = response;

        if (statusCode === 404) {
            return {
                isImage: false,
                error: statusCode,
                retry: false,
            }
        } else if (statusCode >= 400) {
            return {
                isImage: false,
                error: statusCode,
                retry: true,
            }
        }

        const buffer = response.body
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
        const imageSizeInKB = Math.floor(buffer.length / 1024)
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
                    error: `Image width or height is too small. Actual: width: ${width}, height: ${height}. Minimum: width: ${imageCheck.minWidth}, height: ${imageCheck.minHeight} `,
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
            error: `Image check crashed. Error: ${e.message}`,
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
