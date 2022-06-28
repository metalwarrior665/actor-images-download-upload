const Apify = require('apify');

const { Stats } = require('./stats');
const { loadAndProcessItems, hideTokenFromInput } = require('./utils');
const { checkInput, constantsFromInput } = require('./input-parser');
const handleIterationFunction = require('./handle-iteration-function.js');

Apify.main(async () => {
    let input = await Apify.getValue('INPUT');
    console.log('INPUT');
    console.dir(hideTokenFromInput(input));

    input = checkInput(input);

    const { mainInput, iterationInput } = await constantsFromInput(input);

    const { datasetId, limit, offset, storeInput, batchSize } = mainInput;

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
    if (datasetId) {
        console.log(`Loading from dataset: ${datasetId}`);
        const dataset = await Apify.openDataset(datasetId);
        const { itemCount } = await dataset.getInfo();
        stats.set(props.itemsTotal, itemCount, true);
        await loadAndProcessItems({
            datasetId,
            handleIterationFunction,
            batchSize,
            iterationIndex,
            iterationInput,
            stats,
            originalInput: input,
            limit,
            offset,
        });
    } else if (storeInput) {
        const match = storeInput.match(/(\w{17})-(.+)/);
        if (!match) {
            throw new Error(`Cannot match storeInput ${storeInput}, probably it has wrong format?`);
        }
        const [ , storeId, recordKey ] = match;
        console.log(`Loading from kvStore - storeId: ${storeId}, recordKey: ${recordKey}`);
        let KVStoreValue;
        try {
            const KVStore = await Apify.openKeyValueStore(storeId);
            KVStoreValue = await KVStore.getValue(recordKey);
        } catch {
            throw new Error('Key value store or record inside it not found, we cannot continue');
        }
        if (KVStoreValue && Array.isArray(KVStoreValue)) {
            console.log('We got items from kv, count:', KVStoreValue.length);
            stats.set(props.itemsTotal, KVStoreValue.length, true);
            await handleIterationFunction({ data: KVStoreValue, iterationInput, iterationIndex: 0, stats, originalInput: input });
        } else {
            console.log('We cannot load data from kv store because they are not in a proper format');
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
