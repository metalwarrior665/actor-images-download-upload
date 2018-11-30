const Apify = require('apify');
const Promise = require('bluebird');
const objectPath = require("object-path");
const R = require('ramda');
const md5 = require('md5');

const { Stats } = require('./stats')
const { loadItems, getObjectWithAllKeysFromS3, setS3 } = require('./utils')
const { defaultFileNameFunction, defaultPostDownloadFunction } = require('./default-functions');
const { downloadUpload } = require('./download-upload')
const { checkInput } = require('./input-parser');

const stats = new Stats()
stats.display()
const props = stats.getProps();

// periodially displaying stats
setInterval(() => {
    stats.display();
}, 20 * 1000);

const keyValueStores = Apify.client.keyValueStores;

Apify.main(async () => {
    // Get input of your act
    let input = await Apify.getValue('INPUT');
    console.log('INPUT')
    console.dir(input)

    // handling crawler webhooks
    if(input.data){
        try{
            console.log('trying to parse crawler webhook data')
            input = { inputId: input._id, ...JSON.parse(input.data) }
            console.log('crawler webhook data parsed as')
            console.dir(input)
        } catch(e) {
            throw new Error(`Parsing crawler webhook data failed with error: ${e.message}`)
        }
    }

    input = checkInput(input);

    const {
        uploadTo,
        pathToImageUrls,
        inputId,
        recordKey,
        outputTo,
        fileNameFunction = defaultFileNameFunction,
        preDownloadFunction,
        postDownloadFunction = defaultPostDownloadFunction,
        saveStats,
        maxItems,
        concurrency,
        flatten,
        s3Bucket,
        s3AccessKeyId,
        s3SecretAccessKey,
    } = input

    const s3Credentials = { s3Bucket, s3AccessKeyId, s3SecretAccessKey }
    const uploadOptions = {
        uploadTo,
        s3Client: uploadTo === 's3' ? setS3(s3Credentials) : null
    }

    let images = (await Apify.getValue('STATE')) || {}
    Object.keys(images).forEach((imageUrl) => {
        images[imageUrl].fromState = true;
    });;
    let inputData = []

    console.log('images loaded from state', Object.keys(images).length)

    // SAVING STATE
    setInterval(async ()=>{
        await Apify.setValue('STATE', images)
    }, 20 * 1000)

    // LOADING FROM KV
    if(input.storeId){
        console.log('Loading from kv')
    }

    // LOADING FROM ANYWHERE
    if (inputId) {
        console.log('loading from dataset')
        const isDataset = await Apify.client.datasets.getDataset({
            datasetId: inputId,
        }).catch((e) => console.log('Dataset not found we will try crawler.'));
        const isCrawler = await Apify.client.crawlers.getExecutionDetails({
            executionId: inputId,
        }).catch((e) => console.log('Crawler not found we will try key vakue store.'));

        if (isDataset || isCrawler) {
            const type = isDataset ? 'dataset' : 'crawler';
            const datasetOrExecutionItems = await loadItems(inputId, 0, [], type );
            if (datasetOrExecutionItems) {
                console.log('we got total items from dataset, count:', datasetOrExecutionItems.length)
                inputData = inputData.concat(datasetOrExecutionItems)
            }
        } else {
            const keyValueStore = await keyValueStores.getRecord({
                 key: recordKey, storeId: inputId
            }).catch((e) => console.log('Key value store or record inside him not found, we cannot continue'));
            if (keyValueStore && Array.isArray(keyValueStore.body)) {
                console.log('We got items from kv, count:',keyValueStore.body.length)
                inputData = inputData.concat(keyValueStore.body)
            } else {
                console.log('We cannot load data from kv store because they are not in a proper format')
            }
        }
    }

    if (inputData.length === 0) {
        throw new Error('We loaded no data from the specified inputId, aborting the run!')
    }

    if(flatten) {
        try{
            inputData = R.flatten(inputData)
            console.log('we flattened the results')
        } catch(e) {
            console.dir(e);
            throw new Error('Flattening of input data failed with error:', e.message);
        }
    }
    inputData = inputData.slice(0, maxItems)

    stats.set(props.itemsTotal, inputData.length)

    if(inputData.length === 0) throw new Error("Didn't load any items from kv store or dataset")

    console.log(`We got ${inputData.length} items totally from kv, dataset and/or crawler execution`)
    console.log('STARTING DOWNLOAD')

    // filtering items
    if (preDownloadFunction){
        try{
            console.log('Transforming items with pre download function')
            console.log(preDownloadFunction)
            inputData = await preDownloadFunction(inputData)
            console.log(`We got ${inputData.length} after pre download`)
        } catch(e) {
            console.dir(e);
            throw new Error('Pre download function failed with error');
        }
    }

    const itemsSkippedCount = inputData.filter((item) => !!item.skipDownload).length;
    stats.set(props.itemsSkipped, itemsSkippedCount);

    // add images to state
    try{
        inputData.forEach((item) => {
            if (item.skipDownload) return // we skip item with this field
            let imagesFromPath = objectPath.get(item, pathToImageUrls)
            if (!Array.isArray(imagesFromPath) && typeof imagesFromPath !== 'string') {
                stats.inc(props.itemsWithoutImages);
                return;
            }
            if (typeof imagesFromPath === 'string') {
                imagesFromPath = [imagesFromPath];
            }
            if (imagesFromPath.length === 0) {
                stats.inc(props.itemsWithoutImages);
                return;
            }
            imagesFromPath.forEach((image) => {
                stats.inc(props.imagesTotal)
                if (images[image] === undefined) { // undefined means they were not yet added
                    images[image] = {} // false means they were not yet downloaded / uploaded or the process failed
                } else if (typeof images[image] === 'object' && images[image].fromState) {
                    stats.inc(props.imagesDownloadedPreviously);
                } else {
                    stats.inc(props.imagesDuplicates);
                }
            })
        })
    } catch(e) {
        console.dir(e)
        throw new Error('Adding images to state failed with error:', e.message)
    }

    const objectWithPreviouslyUploadedImages = null // await getObjectWithAllKeysFromS3(input.domain)

    // parrallel download/upload processing
    await Promise.map(
        Object.keys(images),
        async (url) => {
            if(typeof images[url].imageUploaded === 'boolean') return; // means it was already download before
            const key = fileNameFunction(url, md5);
            if(objectWithPreviouslyUploadedImages && objectWithPreviouslyUploadedImages[key]){
                stats.inc(props.imagesAlreadyOnS3);
                return
            }
            const info = await downloadUpload(url, key, uploadOptions);
            stats.add(props.timeSpentDownloading, info.time.downloading);
            stats.add(props.timeSpentProcessing, info.time.processing);
            stats.add(props.timeSpentUploading, info.time.uploading);
            images[url] = info;
            if (info.imageUploaded) {
                stats.inc(props.imagesUploaded);
            } else {
                stats.inc(props.imagesFailed);
                stats.addFailed({ url, errors: info.errors });
            }
        },
        {concurrency}
    )

    // postprocessing function
    if ((outputTo && outputTo !== 'no-output') && postDownloadFunction) {
        console.log('Will save output data to:', outputTo);
        const processedData = await postDownloadFunction(inputData, images, fileNameFunction, md5)

        if (outputTo === 'key-value-store') {
            await Apify.setValue('OUTPUT', processedData);
        }
        if (outputTo === 'dataset') {
            await Apify.pushData(processedData);
        }
    }

    stats.display()

    if (saveStats) {
        try {
            const runStarted = process.env.APIFY_STARTED_AT;
            const runFinished = new Date().toISOString();
            const runTimeSeconds = Math.round((new Date(runFinished).getTime() - new Date(runStarted).getTime())/1000)

            const dataset = await Apify.openDataset(saveStats);
            await dataset.pushData({
                runStarted,
                runFinished,
                runTimeSeconds,
                input,
                stats: stats.return(),
            });
        } catch (e) {
            console.log('Saving stats failed with error:', e.message);
        }
    }
    console.log('Downloading finished');
});
