const Apify = require('apify');

const { Stats } = require('./stats');
const { loadItems, hideTokenFromInput } = require('./utils');
const { checkInput, handleCrawlerWebhook, constantsFromInput } = require('./input-parser');
const { iterationProcess } = require('./iteration-process.js');

Apify.main(async () => {
    let input = await Apify.getValue('INPUT');
    console.log('INPUT');
    console.dir(hideTokenFromInput(input));

    input = handleCrawlerWebhook(input);
    input = checkInput(input);

    const { mainInput, iterationInput } = constantsFromInput(input);

    const { inputId, batchSize, recordKey } = mainInput;

    // Stats init
    const statsState = await Apify.getValue('stats-state');
    const stats = new Stats(statsState);
    stats.display();
    const props = stats.getProps();

    const initialIterationState = {
        0: {
            index: 0,
            started: false,
            finished: false,
            pushed: 0,
        },
    };
    let iterationState = await Apify.getValue('STATE-ITERATION');
    if (!iterationState) {
        iterationState = initialIterationState;
        await Apify.setValue('STATE-ITERATION', iterationState);
    }
    const { index: iterationIndex } = Object.values(iterationState).find((stateObj) => !stateObj.finished);

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
            console.log(`Starting iteration index: ${iterationIndex}`);
            await loadItems(
                { id: inputId, type, callback: iterationProcess, batchSize, iterationInput, stats },
                iterationIndex * batchSize,
                iterationIndex,
            );
        } else {
            const keyValueStore = await Apify.client.keyValueStores.getRecord({
                key: recordKey, storeId: inputId,
            }).catch(() => console.log('Key value store or record inside him not found, we cannot continue'));
            if (keyValueStore && Array.isArray(keyValueStore.body)) {
                console.log('We got items from kv, count:', keyValueStore.body.length);
                stats.set(props.itemsTotal, keyValueStore.body.length, true);
                await iterationProcess(keyValueStore.body, iterationInput, 0, stats);
            } else {
                console.log('We cannot load data from kv store because they are not in a proper format');
            }
        }
    }

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
        await Apify.setValue('stats-state', stats.return());
        await Apify.setValue('stats', statsObject);
    } catch (e) {
        console.log('Saving stats failed with error:', e.message);
    }

    console.log('Downloading finished');
});
