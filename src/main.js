const Apify = require('apify');
// const Promise = require('bluebird');
const objectPath = require('object-path');
const R = require('ramda');
const md5 = require('md5');

const { Stats } = require('./stats');
const { loadItems, getObjectWithAllKeysFromS3, setS3, hideTokenFromInput } = require('./utils');
const { defaultFileNameFunction, defaultPostDownloadFunction } = require('./default-functions');
const { downloadUpload } = require('./download-upload');
const { checkInput } = require('./input-parser');
const { DATASET_BATCH_SIZE, REQUEST_EXTERNAL_TIMEOUT } = require('./constants.js');

Apify.main(async () => {
    // Get input of your act
    let input = await Apify.getValue('INPUT');
    console.log('INPUT');
    console.dir(hideTokenFromInput(input));

    // handling crawler webhooks
    if (input.data) {
        try {
            console.log('trying to parse crawler webhook data');
            input = { inputId: input._id, ...JSON.parse(input.data) };
            console.log('crawler webhook data parsed as');
            console.dir(input);
        } catch (e) {
            throw new Error(`Parsing crawler webhook data failed with error: ${e.message}`);
        }
    }

    input = checkInput(input);

    const {
        uploadTo,
        pathToImageUrls = '',
        inputId,
        recordKey,
        outputTo,
        fileNameFunction = defaultFileNameFunction,
        preDownloadFunction,
        postDownloadFunction = defaultPostDownloadFunction,
        loadState,
        maxItems,
        concurrency,
        flatten,
        imageCheckType,
        imageCheckMinSize,
        imageCheckMinWidth,
        imageCheckMinHeight,
        imageCheckMaxRetries,
        s3Bucket,
        s3AccessKeyId,
        s3SecretAccessKey,
        s3CheckIfAlreadyThere,
        convertWebpToPng,
        downloadTimeout,
        handleFunctionTimeout,
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
    };
    const downloadOptions = {
        downloadTimeout: downloadTimeout || REQUEST_EXTERNAL_TIMEOUT,
        maxRetries: imageCheckMaxRetries,
    };
    const downloadUploadOptions = { downloadOptions, uploadOptions };
    const handleTimeout = handleFunctionTimeout || downloadOptions.downloadTimeout * imageCheckMaxRetries + downloadOptions.downloadTimeout;
    console.log(`handle timeout is: ${handleTimeout}`);

    console.log('loading state...');

    let images = (await Apify.getValue('STATE')) || {};
    if (loadState && Object.keys(images).length === 0) {
        try {
            images = await Apify.client.keyValueStores.getRecord({ storeId: loadState, key: 'STATE' }).then((res) => res.body);
        } catch (e) {
            console.dir(e);
            throw new Error('State could not be loaded because of error', e);
        }
    }

    Object.keys(images).forEach((key) => {
        images[key].fromState = true;
    });

    console.log('images loaded from state:');
    console.log(`Uploaded: ${Object.values(images).filter((val) => val.imageUploaded).length}`);
    console.log(`Failed: ${Object.values(images).filter((val) => val.imageUploaded === false).length}`);
    console.log(`Not yet handled: ${Object.values(images).filter((val) => val.imageUploaded === undefined).length}`);

    // Stats init
    const statsState = await Apify.getValue('stats-state');
    const stats = new Stats(statsState);
    stats.display();
    const props = stats.getProps();

    // periodially displaying stats
    const statsInterval = setInterval(async () => {
        stats.display();
        await Apify.setValue('stats-state', stats.return());
    }, 10 * 1000);

    // SAVING STATE
    const stateInterval = setInterval(async () => {
        await Apify.setValue('STATE', images);
    }, 10 * 1000);

    let processedState = await Apify.getValue('processed-state');
    const initialPushingState = (await Apify.getValue('PUSHING-STATE')) || 0;

    // LOADING FROM KV
    if (input.storeId) {
        console.log('Loading from kv');
    }

    const mainProcess = async (inputData, iterationIndex) => {
        const updateStats = !processedState || processedState < iterationIndex;
        if (inputData.length === 0) {
            throw new Error('We loaded no data from the specified inputId, aborting the run!');
        }

        if (flatten) {
            try {
                inputData = R.flatten(inputData);
                console.log('we flattened the results');
            } catch (e) {
                console.dir(e);
                throw new Error('Flattening of input data failed with error:', e.message);
            }
        }
        inputData = inputData.slice(0, maxItems);

        if (inputData.length === 0) throw new Error("Didn't load any items from kv store or dataset");

        console.log(`We got ${inputData.length} items in iteration index: ${iterationIndex}`);
        console.log('STARTING DOWNLOAD');

        // filtering items
        if (preDownloadFunction) {
            try {
                console.log('Transforming items with pre download function');
                console.log(preDownloadFunction);
                inputData = await preDownloadFunction(inputData);
                console.log(`We got ${inputData.length} after pre download`);
            } catch (e) {
                console.dir(e);
                throw new Error('Pre download function failed with error');
            }
        }

        const itemsSkippedCount = inputData.filter((item) => !!item.skipDownload).length;
        stats.add(props.itemsSkipped, itemsSkippedCount, updateStats);

        // add images to state
        try {
            inputData.forEach((item, itemIndex) => {
                if (item.skipDownload) return; // we skip item with this field
                let imagesFromPath = objectPath.get(item, pathToImageUrls);
                if (!Array.isArray(imagesFromPath) && typeof imagesFromPath !== 'string') {
                    stats.inc(props.itemsWithoutImages, updateStats);
                    return;
                }
                if (typeof imagesFromPath === 'string') {
                    imagesFromPath = [imagesFromPath];
                }
                if (imagesFromPath.length === 0) {
                    stats.inc(props.itemsWithoutImages, updateStats);
                    return;
                }
                imagesFromPath.forEach((image) => {
                    stats.inc(props.imagesTotal, updateStats);
                    if (typeof image !== 'string') {
                        stats.inc(props.imagesNotString, updateStats);
                        return;
                    }
                    if (images[image] === undefined) { // undefined means they were not yet added
                        images[image] = {
                            itemIndex,
                        }; // false means they were not yet downloaded / uploaded or the process failed
                    } else if (typeof images[image] === 'object' && images[image].fromState) {
                        // stats.inc(props.imagesDownloadedPreviously, updateStats);
                    } else {
                        stats.inc(props.imagesDuplicates, updateStats);
                    }
                });
            });
        } catch (e) {
            console.dir(e);
            throw new Error('Adding images to state failed with error:', e.message);
        }

        const checkIfAlreadyOnS3 = async (key, uploadOptions) => {
            try {
                const data = await uploadOptions.s3Client.headObject({
                    Key: key,
                }).promise();
                if (data.ContentLength > 0) {
                    return { isThere: true, errors: [] };
                }
                return { isThere: false, errors: [] };
            } catch (e) {
                return { isThere: false, errors: [e.message] };
            }
        };

        const requestList = new Apify.RequestList({ sources: Object.keys(images).map((url, index) => ({ url, userData: { index } })) });
        await requestList.initialize();

        if (!processedState || iterationIndex >= processedState) {
            processedState = iterationIndex;
            await Apify.setValue('processed-state', processedState);
        }

        const handleRequestFunction = async ({ request }) => {
            const { url } = request;
            const { index } = request.userData;

            const mainPromise = async () => {
                if (typeof images[url].imageUploaded === 'boolean') return; // means it was already download before
                const itemOfImage = inputData[images[url].itemIndex];
                const key = fileNameFunction(url, md5, index, itemOfImage);
                if (s3CheckIfAlreadyThere && uploadTo === 's3') {
                    const { isThere, errors } = await checkIfAlreadyOnS3(key, uploadOptions);
                    if (isThere) {
                        images[url] = {
                            imageUploaded: true, // not really uploaded but we need to add this status
                            errors,
                        };
                        stats.inc(props.imagesAlreadyOnS3);
                        return;
                    }
                }
                const info = await downloadUpload(url, key, downloadUploadOptions, imageCheck);
                stats.add(props.timeSpentDownloading, info.time.downloading, true);
                stats.add(props.timeSpentProcessing, info.time.processing, true);
                stats.add(props.timeSpentUploading, info.time.uploading, true);
                images[url] = info;
                if (info.imageUploaded) {
                    stats.inc(props.imagesUploaded, true);
                } else {
                    stats.inc(props.imagesFailed, true);
                    stats.addFailed({ url, errors: info.errors });
                }
            };
            const timeoutPromise = new Promise((resolve, reject) => {
                setTimeout(() => {
                    console.log('Handle function timeouted');
                    stats.inc(props.imagesFailed, true);
                    stats.addFailed({ url, errors: ['Handle function timeout! Code got stuck somewhere probably'] });
                    resolve();
                }, handleTimeout);
            });
            await Promise.race([
                mainPromise,
                timeoutPromise,
            ]);
        };

        const crawler = new Apify.BasicCrawler({
            requestList,
            handleRequestFunction,
            autoscaledPoolOptions: {
                snapshotterOptions: {
                    maxBlockedMillis: 100,
                },
                systemStatusOptions: {
                    maxEventLoopOverloadedRatio: 0.9,
                },
            },
            maxConcurrency: concurrency,
        });

        await crawler.run();

        console.log(`All images in iteration ${iterationIndex} were processed`);

        // postprocessing function
        if ((outputTo && outputTo !== 'no-output')) {
            console.log('Will save output data to:', outputTo);
            const processedData = postDownloadFunction
                ? await postDownloadFunction(inputData, images, fileNameFunction, md5)
                : inputData;
            console.log('Post-download processed data length:', processedData.length);

            if (outputTo === 'key-value-store') {
                const alreadySavedData = (await Apify.getValue('OUTPUT')) || [];
                await Apify.setValue('OUTPUT', alreadySavedData.concat(processedData));
            }

            // Have to save state of dataset push because it takes too long
            if (outputTo === 'dataset') {
                const chunkSize = 500;
                let index = (await Apify.getValue('PUSHING-STATE')) || 0; // eslint-disable-line
                console.log(`Loaded starting index: ${index}`);
                const alreadyIterated = iterationIndex * DATASET_BATCH_SIZE;
                const ceil = processedData.length + alreadyIterated;
                for (; index < ceil; index += chunkSize) {
                    console.log(`pushing data ${index}:${index + chunkSize}`);
                    await Promise.all([
                        Apify.pushData(processedData.slice(index - alreadyIterated, index + chunkSize - alreadyIterated)),
                        Apify.setValue('PUSHING-STATE', index + chunkSize),
                    ]);
                }

                // saving PUSHING-STATE for last time
                await Apify.setValue('PUSHING-STATE', index);
            }
        }
    };

    // LOADING FROM ANYWHERE
    if (inputId) {
        console.log('loading from dataset');
        const isDataset = await Apify.client.datasets.getDataset({
            datasetId: inputId,
        }).catch(() => console.log('Dataset not found we will try crawler.'));
        const isCrawler = await Apify.client.crawlers.getExecutionDetails({
            executionId: inputId,
        }).catch(() => console.log('Crawler not found we will try key vakue store.'));

        if (isDataset || isCrawler) {
            const type = isDataset ? 'dataset' : 'crawler';
            const { itemCount } = await Apify.client.datasets.getDataset({ datasetId: inputId });
            stats.set(props.itemsTotal, itemCount, true);
            const iterationIndex = Math.floor(initialPushingState / DATASET_BATCH_SIZE);
            console.log(`Starting iteration index: ${iterationIndex}`);
            await loadItems({ id: inputId, type, callback: mainProcess },
                iterationIndex * DATASET_BATCH_SIZE,
                iterationIndex,
            );
        } else {
            const keyValueStore = await Apify.client.keyValueStores.getRecord({
                key: recordKey, storeId: inputId,
            }).catch(() => console.log('Key value store or record inside him not found, we cannot continue'));
            if (keyValueStore && Array.isArray(keyValueStore.body)) {
                console.log('We got items from kv, count:', keyValueStore.body.length);
                stats.set(props.itemsTotal, keyValueStore.body.length, true);
                await mainProcess(keyValueStore.body);
            } else {
                console.log('We cannot load data from kv store because they are not in a proper format');
            }
        }
    }

    // Saving STATE for last time
    await Apify.setValue('STATE', images);
    await Apify.setValue('stats-state', stats.return());
    clearInterval(stateInterval);
    clearInterval(statsInterval);
    stats.display();

    try {
        const runStarted = process.env.APIFY_STARTED_AT;
        const runFinished = new Date().toISOString();
        const runTimeSeconds = Math.round((new Date(runFinished).getTime() - new Date(runStarted).getTime()) / 1000);
        const statsObject = {
            runStarted,
            runFinished,
            runTimeSeconds,
            input: hideTokenFromInput(input),
            stats: stats.return(),
        };

        // const dataset = await Apify.openDataset(saveStats);
        // await dataset.pushData(statsObject);
        await Apify.setValue('stats', statsObject);
    } catch (e) {
        console.log('Saving stats failed with error:', e.message);
    }

    console.log('Downloading finished');
});
