import { Actor, log } from 'apify';

import { Stats, StatsState } from './stats.js';
import { loadAndProcessItems, hideTokenFromInput } from './utils.js';
import { checkInput, constantsFromInput } from './input-parser.js';
import handleIterationFunction from './handle-iteration-function.js';

await Actor.init();

let input = await Actor.getInput();
log.info('INPUT');
console.dir(hideTokenFromInput(input));

input = checkInput(input);

const { mainInput, iterationInput } = await constantsFromInput(input);

const { datasetId, limit, offset, storeInput, batchSize } = mainInput;

// Stats init
const statsState: StatsState = await Actor.getValue('stats-state') as StatsState;
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
let iterationState: any = await Actor.getValue('STATE-ITERATION');
if (!iterationState) {
    iterationState = initialIterationState;
    await Actor.setValue('STATE-ITERATION', iterationState);
}
const { index: iterationIndex } = Object.values(iterationState).find((stateObj: any) => !stateObj.finished) as any;

// LOADING FROM ANYWHERE
if (datasetId) {
    log.info(`Loading from dataset: ${datasetId}`);
    const dataset = await Actor.openDataset(datasetId, { forceCloud: true });
    const { itemCount } = await dataset.getInfo() as { itemCount: number };
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
    const [, storeId, recordKey] = match;
    log.info(`Loading from kvStore - storeId: ${storeId}, recordKey: ${recordKey}`);
    let KVStoreValue;
    try {
        const KVStore = await Actor.openKeyValueStore(storeId);
        KVStoreValue = await KVStore.getValue(recordKey);
    } catch {
        throw new Error('Key value store or record inside it not found, we cannot continue');
    }
    if (KVStoreValue && Array.isArray(KVStoreValue)) {
        log.info(`We got items from kv, count: ${KVStoreValue.length}`);
        stats.set(props.itemsTotal, KVStoreValue.length, true);
        await handleIterationFunction({ data: KVStoreValue, iterationInput, iterationIndex: 0, stats, originalInput: input });
    } else {
        log.warning('We cannot load data from kv store because they are not in a proper format');
    }
}

try {
    const runStarted = process.env.APIFY_STARTED_AT as string;
    const runFinished = new Date().toISOString();
    const runTimeSeconds = Math.round((new Date(runFinished).getTime() - new Date(runStarted).getTime()) / 1000);
    const statsObject = {
        runStarted,
        runFinished,
        runTimeSeconds,
        input: hideTokenFromInput(input),
        stats: stats.return(),
    };

    // const dataset = await Actor.openDataset(saveStats);
    // await dataset.pushData(statsObject);
    await Actor.setValue('stats-state', stats.return());
    await Actor.setValue('stats', statsObject);
} catch (e) {
    log.error(`Saving stats failed with error: ${(e as Error).message}`);
}

log.info('Downloading finished');

await Actor.exit();
