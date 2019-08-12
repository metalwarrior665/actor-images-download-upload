const Apify = require('apify');

const { defaultFileNameFunction } = require('./default-functions');
const { DEFAULT_BATCH_SIZE, DEFAULT_REQUEST_EXTERNAL_TIMEOUT } = require('./constants.js');
const { setS3 } = require('./utils.js');

module.exports.constantsFromInput = async (input) => {
    const {
        uploadTo,
        pathToImageUrls = '',
        inputId,
        recordKey,
        outputTo,
        fileNameFunction = defaultFileNameFunction,
        preDownloadFunction,
        postDownloadFunction,
        concurrency,
        imageCheckType = 'content-type',
        imageCheckMinSize,
        imageCheckMinWidth,
        imageCheckMinHeight,
        imageCheckMaxRetries = 1,
        uploadStoreName,
        s3Bucket,
        s3AccessKeyId,
        s3SecretAccessKey,
        s3CheckIfAlreadyThere,
        convertWebpToPng,
        downloadTimeout = DEFAULT_REQUEST_EXTERNAL_TIMEOUT,
        batchSize = DEFAULT_BATCH_SIZE,
        stateFields,
        proxyConfiguration,
    } = input;

    const imageCheck = {
        type: imageCheckType,
        minSize: imageCheckMinSize,
        minWidth: imageCheckMinWidth,
        minHeight: imageCheckMinHeight,
        convertWebpToPng,
    };
    const s3Credentials = { s3Bucket, s3AccessKeyId, s3SecretAccessKey };
    const uploadOptions = {
        uploadTo,
        s3Client: uploadTo === 's3' ? setS3(s3Credentials) : null,
        storeHandle: uploadStoreName ? await Apify.openKeyValueStore(uploadStoreName) : null,
    };
    const downloadOptions = {
        downloadTimeout,
        maxRetries: imageCheckMaxRetries,
        proxyConfiguration,
    };
    const downloadUploadOptions = { downloadOptions, uploadOptions };

    const finalInput = {
        mainInput: {
            inputId,
            batchSize,
            recordKey,
        },
        iterationInput: {
            uploadTo,
            pathToImageUrls,
            outputTo,
            fileNameFunction,
            preDownloadFunction,
            postDownloadFunction,
            concurrency,
            s3CheckIfAlreadyThere,
            convertWebpToPng,
            batchSize,
            imageCheck,
            downloadUploadOptions,
            stateFields,
        },
    };
    return finalInput;
};

module.exports.checkInput = (input) => {
    if (!input.uploadTo) throw new Error('INPUT.uploadTo has to be specified!');

    if (input.uploadTo === 's3' && (!input.s3Bucket || !input.s3AccessKeyId || !input.s3SecretAccessKey)) {
        throw new Error('If you want to upload to S3, you have to provide all of s3Bucket, s3AccessKeyId and s3SecretAccessKey in input!');
    }

    if (!input.inputId) {
        throw new Error('There is no input id to get image URLs from!');
    }

    if (typeof input.fileNameFunction === 'string') {
        try {
            input.fileNameFunction = eval(input.fileNameFunction); // eslint-disable-line
        } catch (e) {
            throw new Error('fileName function cannot be evaluated as a function. Error:', e.message);
        }
    }

    if (typeof input.preDownloadFunction === 'string') {
        try {
            input.preDownloadFunction = eval(input.preDownloadFunction); // eslint-disable-line
        } catch (e) {
            throw new Error('preDownloadFunction function cannot be evaluated as a function. Error:', e.message);
        }
    }

    if (typeof input.postDownloadFunction === 'string') {
        try {
            input.postDownloadFunction = eval(input.postDownloadFunction); // eslint-disable-line
        } catch (e) {
            throw new Error('postDownloadFunction function cannot be evaluated as a function. Error:', e.message);
        }
    }

    if (!input.pathToImageUrls) {
        console.log('Path to image Urls not specified, will assume that input is plain image Urls array');
    }
    return input;
};
