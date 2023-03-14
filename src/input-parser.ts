import { Actor, log } from 'apify';

import { defaultFileNameFunction } from './default-functions.js';
import { DEFAULT_BATCH_SIZE, DEFAULT_REQUEST_EXTERNAL_TIMEOUT } from './constants.js';
import { setS3 } from './utils.js';
import { ImageCheck } from './types.js';

export const constantsFromInput = async (input: any) => {
    // Small hack to automatically load from webhook (no need for payload template)
    const datasetId = input.datasetId || input.resource?.defaultDatasetId;
    const items = input.items || null;

    const {
        // main
        pathToImageUrls = '',
        fileNameFunction = defaultFileNameFunction,
        // Input/output options
        limit,
        offset,
        outputTo,
        storeInput,
        outputDatasetId = undefined,
        // Image upload options
        uploadTo,
        uploadStoreName,
        s3Bucket,
        s3AccessKeyId,
        s3SecretAccessKey,
        s3CheckIfAlreadyThere,
        // Transforming functions
        preDownloadFunction,
        postDownloadFunction,
        // Image check
        imageCheckType = 'content-type',
        imageCheckMinSize,
        imageCheckMinWidth,
        imageCheckMinHeight,
        imageCheckMaxRetries = 6,
        // Misc
        proxyConfiguration,
        maxConcurrency,
        stateFields,
        downloadTimeout = DEFAULT_REQUEST_EXTERNAL_TIMEOUT,
        batchSize = DEFAULT_BATCH_SIZE,
        convertWebpToPng,
        noDownloadRun = false,
    } = input;

    const imageCheck: ImageCheck = {
        type: imageCheckType,
        minSize: imageCheckMinSize,
        minWidth: imageCheckMinWidth,
        minHeight: imageCheckMinHeight,
        convertWebpToPng,
    };
    const s3Credentials = { s3Bucket, s3AccessKeyId, s3SecretAccessKey };
    const uploadOptions: any = {
        uploadTo,
        s3Client: uploadTo === 's3' ? setS3(s3Credentials) : null,
        storeHandle: null,
    };

    if (uploadTo === 'zip-file') {
        uploadOptions.storeHandle = await Actor.openKeyValueStore(`zip-store-${Actor.config.get('defaultDatasetId')}`);
    } else if (uploadStoreName) {
        uploadOptions.storeHandle = await Actor.openKeyValueStore(uploadStoreName);
    }

    const downloadOptions = {
        downloadTimeout,
        maxRetries: imageCheckMaxRetries,
        proxyConfiguration,
    };
    const downloadUploadOptions = { downloadOptions, uploadOptions };

    const finalInput = {
        mainInput: {
            datasetId,
            items,
            limit,
            offset,
            storeInput,
            batchSize,
        },
        iterationInput: {
            uploadTo,
            pathToImageUrls,
            outputTo,
            outputDatasetId,
            fileNameFunction,
            preDownloadFunction,
            postDownloadFunction,
            maxConcurrency,
            s3CheckIfAlreadyThere,
            convertWebpToPng,
            batchSize,
            imageCheck,
            downloadUploadOptions,
            stateFields,
            noDownloadRun,
        },
    };
    return finalInput;
};

export const checkInput = (input: any) => {
    // Small hack to automatically load from webhook (no need for payload template)
    const datasetId = input.datasetId || input.resource?.defaultDatasetId;

    if (!input.uploadTo) throw new Error('INPUT.uploadTo has to be specified!');

    if (input.uploadTo === 's3' && (!input.s3Bucket || !input.s3AccessKeyId || !input.s3SecretAccessKey)) {
        throw new Error('If you want to upload to S3, you have to provide all of s3Bucket, s3AccessKeyId and s3SecretAccessKey in input!');
    }

    if (!input.items?.length && !datasetId && !input.storeInput) {
        throw new Error('You have to specify either datasetId, storeInput or items in input!');
    }

    if (input.items?.length && datasetId) {
        log.warning('You cannot specify both datasetId and items in input! Ignoring items and using datasetId instead.');
        input.items = null;
    }

    if (!input.items?.length) {
        if (!datasetId && !input.storeInput) {
            throw new Error('"datasetId or storeInput missing from the input!!!"');
        }
    
        if (datasetId && datasetId.length !== 17) {
            throw new Error('datasetId has to be a string with 17 characters! Check if you copied it correctly.');
        }
    } else if (!Array.isArray(input.items)) {
        throw new Error('items has to be an array!');
    }

    // Should have format storeId-recordKey
    if (input.storeInput) {
        const split = input.storeInput.split('-');
        if (split.length < 2 || split[0].length !== 17) {
            throw new Error('storeInput has wrong format! It should be storeId and recordKey joined with a hyphen!');
        }
    }

    if (typeof input.fileNameFunction === 'string') {
        try {
            input.fileNameFunction = eval(input.fileNameFunction); // eslint-disable-line
        } catch (e) {
            throw new Error(`fileName function cannot be evaluated as a function. Error: ${(e as Error).message}`);
        }
    }

    if (typeof input.preDownloadFunction === 'string') {
        try {
            input.preDownloadFunction = eval(input.preDownloadFunction); // eslint-disable-line
        } catch (e) {
            throw new Error(`preDownloadFunction function cannot be evaluated as a function. Error: ${(e as Error).message}`);
        }
    }

    if (typeof input.postDownloadFunction === 'string') {
        try {
            input.postDownloadFunction = eval(input.postDownloadFunction); // eslint-disable-line
        } catch (e) {
            throw new Error(`postDownloadFunction function cannot be evaluated as a function. Error: ${(e as Error).message}`);
        }
    }

    if (!input.pathToImageUrls) {
        log.warning('Path to image Urls not specified, will assume that input is plain image Urls array');
    }

    return input;
};
