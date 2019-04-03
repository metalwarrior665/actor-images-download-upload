const Apify = require('apify');

const objectPath = require('object-path');
const md5 = require('md5');

const path = require('path');
const fs = require('fs');
const heapdump = require('heapdump');

const { downloadUpload } = require('./download-upload');

module.exports.iterationProcess = async (inputData, inputIteration, iterationIndex, stats) => {
    const props = stats.getProps();

    // periodially displaying stats
    const statsInterval = setInterval(async () => {
        stats.display();
        await Apify.setValue('stats-state', stats.return());
    }, 10 * 1000);

    const {
        uploadTo,
        pathToImageUrls,
        outputTo,
        fileNameFunction,
        preDownloadFunction,
        postDownloadFunction,
        maxItems,
        concurrency,
        s3CheckIfAlreadyThere,
        imageCheck,
        downloadUploadOptions,
    } = inputIteration;
    console.log('loading state...');

    const images = (await Apify.getValue(`STATE-IMAGES-${iterationIndex}`)) || {};

    const iterationState = await Apify.getValue('STATE-ITERATION');
    if (!iterationState[iterationIndex]) {
        iterationState[iterationIndex] = {
            index: iterationIndex,
            pushed: 0,
            started: false,
            finished: false,
        };
    }

    console.log('images loaded from state:');
    console.log(`Uploaded: ${Object.values(images).filter((val) => val.imageUploaded).length}`);
    console.log(`Failed: ${Object.values(images).filter((val) => val.imageUploaded === false).length}`);
    console.log(`Not yet handled: ${Object.values(images).filter((val) => val.imageUploaded === undefined).length}`);

    // SAVING STATE
    const stateInterval = setInterval(async () => {
        await Apify.setValue(`STATE-IMAGES-${iterationIndex}`, images);
    }, 10 * 1000);

    Object.keys(images).forEach((key) => {
        images[key].fromState = true;
    });

    const updateStats = !iterationState[iterationIndex].started;
    if (inputData.length === 0) {
        throw new Error('We loaded no data from the specified inputId, aborting the run!');
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

    const checkIfAlreadyOnS3 = async (key, uploadOptionsPassed) => {
        try {
            const data = await uploadOptionsPassed.s3Client.headObject({
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

    iterationState[iterationIndex].started = true;
    await Apify.setValue('STATE-ITERATION', iterationState);

    const handleRequestFunction = async ({ request }) => {
        const { url } = request;
        const { index } = request.userData;

        if (typeof images[url].imageUploaded === 'boolean') return; // means it was already download before
        const itemOfImage = inputData[images[url].itemIndex];
        const key = fileNameFunction(url, md5, index, itemOfImage);
        if (s3CheckIfAlreadyThere && uploadTo === 's3') {
            const { isThere, errors } = await checkIfAlreadyOnS3(key, downloadUploadOptions.uploadOptions);
            if (isThere) {
                images[url] = {
                    imageUploaded: true, // not really uploaded but we need to add this status
                    errors,
                };
                stats.inc(props.imagesAlreadyOnS3, true);
                return;
            }
        }
        const info = await downloadUpload(url, key, downloadUploadOptions, imageCheck);
        if (downloadUploadOptions.isDebug) {
            stats.add(props.timeSpentDownloading, info.time.downloading, true);
            stats.add(props.timeSpentProcessing, info.time.processing, true);
            stats.add(props.timeSpentUploading, info.time.uploading, true);
        }
        images[url] = info;
        if (info.imageUploaded) {
            stats.inc(props.imagesUploaded, true);
        } else {
            stats.inc(props.imagesFailed, true);
            stats.addFailed({ url, errors: info.errors });
        }
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
        handleFailedRequestFunction: async ({ request, error }) => {
            const { url } = request;
            stats.inc(props.imagesFailed, true);
            stats.addFailed({ url, errors: [`Handle function failed! ${error.toString()}`] });
        },
        handleRequestTimeoutSecs: 180,
    });

    await crawler.run();

    console.log(`All images in iteration ${iterationIndex} were processed`);

    // For debugging memory leak, remove later
    if (downloadUploadOptions.isDebug) {
        const dumpName = `${Date.now()}-${iterationIndex}.heapsnapshot`;
        const dumpPath = path.join(__dirname, dumpName);

        heapdump.writeSnapshot(dumpPath, (err, filename) => {
            console.log('snapshot written:', err, filename);
        });

        const dumpBuff = fs.readFileSync(dumpPath);
        await Apify.setValue(dumpName, dumpBuff, { contentType: 'application/octet-stream' });
    }

    // postprocessing function
    if ((outputTo && outputTo !== 'no-output')) {
        console.log('Will save output data to:', outputTo);
        let processedData = postDownloadFunction
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
            let index = iterationState[iterationIndex].pushed;
            console.log(`Loaded starting index: ${index}`);
            for (; index < processedData.length; index += chunkSize) {
                console.log(`pushing data ${index}:${index + chunkSize}`);
                iterationState[iterationIndex].pushed = index + chunkSize;
                await Promise.all([
                    Apify.pushData(processedData.slice(index, index + chunkSize)),
                    Apify.setValue('STATE-ITERATION', iterationState),
                ]);
            }
        }
        processedData = null;
    }
    clearInterval(statsInterval);
    // Saving STATE for last time
    clearInterval(stateInterval);
    iterationState[iterationIndex].finished = true;
    iterationState[iterationIndex + 1] = {
        index: iterationIndex + 1,
        started: false,
        finished: false,
        pushed: 0,
    };
    await Apify.setValue('STATE-ITERATION', iterationState);
    await Apify.setValue(`STATE-IMAGES-${iterationIndex}`, images);
    inputData = null;
    console.log('END OF ITERATION STATS:');
    stats.display();
};
