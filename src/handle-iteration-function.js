const Apify = require('apify');

const objectPath = require('object-path');
const md5 = require('md5');

// const path = require('path');
// const fs = require('fs');
// const heapdump = require('heapdump');

const { downloadUpload } = require('./download-upload');
const { checkIfAlreadyOnS3 } = require('./utils');

module.exports = async ({ data, iterationInput, iterationIndex, stats, originalInput }) => {
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
        maxConcurrency,
        s3CheckIfAlreadyThere,
        imageCheck,
        downloadUploadOptions,
        stateFields,
        noDownloadRun,
    } = iterationInput;
    console.log('loading state...');

    const state = (await Apify.getValue(`STATE-IMAGES-${iterationIndex}`)) || {};

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
    console.log(`Uploaded: ${Object.values(state).filter((val) => val.imageUploaded).length}`);
    console.log(`Failed: ${Object.values(state).filter((val) => val.imageUploaded === false).length}`);
    console.log(`Not yet handled: ${Object.values(state).filter((val) => val.imageUploaded === undefined).length}`);

    // SAVING STATE
    const stateInterval = setInterval(async () => {
        await Apify.setValue(`STATE-IMAGES-${iterationIndex}`, state);
    }, 10 * 1000);

    Object.keys(state).forEach((key) => {
        state[key].fromState = true;
    });

    const updateStats = !iterationState[iterationIndex].started;
    if (data.length === 0) {
        throw new Error('We loaded no data from the specified input, aborting the run!');
    }

    if (data.length === 0) throw new Error("Didn't load any items from kv store or dataset");

    console.log(`We got ${data.length} items in iteration index: ${iterationIndex}`);
    console.log('STARTING DOWNLOAD');

    // filtering items
    if (preDownloadFunction) {
        try {
            console.log('Transforming items with pre download function');
            console.log(preDownloadFunction);
            data = await preDownloadFunction({ data, iterationIndex, input: originalInput });
            console.log(`We got ${data.length} after pre download`);
        } catch (e) {
            console.dir(e);
            throw new Error('Pre download function failed with error');
        }
    }

    const itemsSkippedCount = data.filter((item) => !!item.skipDownload).length;
    stats.add(props.itemsSkipped, itemsSkippedCount, updateStats);

    // add images to state
    try {
        let imageIndex = 0;
        data.forEach((item, itemIndex) => {
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
                // undefined means they were not yet added
                // false means they were not yet downloaded / uploaded or the process failed
                if (state[image] === undefined) {
                    state[image] = {
                        imageIndex,
                        itemIndex,
                    };
                    imageIndex++;
                } else if (typeof state[image] === 'object' && state[image].fromState) {
                    // stats.inc(props.imagesDownloadedPreviously, updateStats);
                } else {
                    if (!state[image].duplicateIndexes) {
                        state[image].duplicateIndexes = [];
                    }
                    if (!state[image].duplicateIndexes.includes(itemIndex)) {
                        state[image].duplicateIndexes.push(itemIndex);
                    }
                    stats.inc(props.imagesDuplicates, updateStats);
                }
            });
        });
    } catch (e) {
        console.dir(e);
        throw new Error('Adding images to state failed with error:', e);
    }

    const requestList = await Apify.openRequestList('main', Object.keys(state).map((url) => ({ url })));

    iterationState[iterationIndex].started = true;
    await Apify.setValue('STATE-ITERATION', iterationState);

    const filterStateFields = (stateObject, fields) => {
        if (!fields) {
            return stateObject;
        }
        const newObject = {
            imageUploaded: stateObject.imageUploaded,
        };
        fields.forEach((field) => {
            newObject[field] = stateObject[field];
        });
        return newObject;
    };

    const handleRequestFunction = async ({ request }) => {
        const { url } = request;

        if (typeof state[url].imageUploaded === 'boolean') return; // means it was already download before
        const item = data[state[url].itemIndex];
        const key = fileNameFunction({ url, md5, state, item, iterationIndex, input: originalInput });
        // If filename is not a string, we don't continue. This can be used to prevent the download at this point
        if (typeof key !== 'string') {
            state[url].imageUploaded = false;
            state[url].errors = [{ when: 'before-download', error: 'fileNameFunction didn\'t provide a string' }];
            state[url] = filterStateFields(state[url], stateFields);
            stats.inc(props.imagesNoFilename, true);
            return;
        }
        if (s3CheckIfAlreadyThere && uploadTo === 's3') {
            const { isThere, errors } = await checkIfAlreadyOnS3(key, downloadUploadOptions.uploadOptions);
            if (isThere) {
                state[url].imageUploaded = true; // not really uploaded but we need to add this status
                state[url].errors = errors;
                state[url] = filterStateFields(state[url], stateFields);
                stats.inc(props.imagesAlreadyOnS3, true);
                return;
            }
        }
        // We provide an option for a dummy run to check duplicates etc.
        const info = noDownloadRun
            ? { imageUploaded: true, time: { downloading: 0, processing: 0, uploading: 0 } }
            : await downloadUpload(url, key, downloadUploadOptions, imageCheck);
        stats.add(props.timeSpentDownloading, info.time.downloading, true);
        stats.add(props.timeSpentProcessing, info.time.processing, true);
        stats.add(props.timeSpentUploading, info.time.uploading, true);

        state[url] = { ...state[url], ...info };
        state[url] = filterStateFields(state[url], stateFields);
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
            desiredConcurrencyRatio: 0.4,
            scaleUpStepRatio: 0.5,
            snapshotterOptions: {
                maxBlockedMillis: 100,
            },
            systemStatusOptions: {
                maxEventLoopOverloadedRatio: 0.9,
            },
        },
        maxConcurrency,
        handleFailedRequestFunction: async ({ request, error }) => {
            const { url } = request;
            stats.inc(props.imagesFailed, true);
            stats.addFailed({ url, errors: [`Handle function failed! ${error.toString()}`] });
        },
        handleRequestTimeoutSecs: 180,
    });

    await crawler.run();

    console.log(`All images in iteration ${iterationIndex} were processed`);

    // TODO: Until fixed, move this to separate fork
    /*
    if (downloadUploadOptions.isDebug) {
        const dumpName = `${Date.now()}-${iterationIndex}.heapsnapshot`;
        const dumpPath = path.join(__dirname, dumpName);

        heapdump.writeSnapshot(dumpPath, (err, filename) => {
            console.log('snapshot written:', err, filename);
        });

        const dumpBuff = fs.readFileSync(dumpPath);
        await Apify.setValue(dumpName, dumpBuff, { contentType: 'application/octet-stream' });
    }
    */

    // postprocessing function
    if ((outputTo && outputTo !== 'no-output')) {
        console.log('Will save output data to:', outputTo);
        let processedData = postDownloadFunction
            ? await postDownloadFunction({ data, state, fileNameFunction, md5, iterationIndex, input: originalInput })
            : data;
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
    await Apify.setValue(`STATE-IMAGES-${iterationIndex}`, state);
    console.log('END OF ITERATION STATS:');
    stats.display();
};
