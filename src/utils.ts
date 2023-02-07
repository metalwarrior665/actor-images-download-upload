import { Actor, log } from 'apify';
import AWS from 'aws-sdk';

export const hideTokenFromInput = (input: any) => {
    const newInput = { ...input, s3AccessKeyId: '******', s3SecretAccessKey: '******' };
    return newInput;
};

export const setS3 = (credentials: any) => {
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

// Simple recursive load from dataset
const loadItems = async ({ datasetId, from, to }: any, offset = 0, items = []): Promise<any> => {
    const maxLoad = 250000;
    const itemCountToLoad = to - (from + offset);
    const limit = Math.min(itemCountToLoad, maxLoad);
    if (limit <= 0) {
        return items;
    }

    const dataset = await Actor.openDataset(datasetId);
    const newItems: any = await dataset.getData({
        offset: from,
        limit,
    }).then((res) => res.items);
    log.info(`LOADED DATA --- From: ${from}, Limit: ${limit}`);

    items = items.concat(newItems);
    if (newItems.length < limit) {
        return items;
    }
    return loadItems({ datasetId, from, to }, offset + maxLoad, items);
};

export const loadAndProcessItems = async ({
    datasetId,
    handleIterationFunction,
    batchSize,
    iterationInput,
    stats,
    iterationIndex,
    originalInput,
    limit,
    offset = 0,
}: any) => {
    const end = limit ? offset + limit : null;
    // The outer loop is for each batch (where you have access to the whole state of the batch)
    while (true) {
        const start = iterationIndex * batchSize + offset;
        const to = start + batchSize;
        const limitedTo = end && end < to ? end : null;
        const items = await loadItems({ datasetId, from: start, to: limitedTo || to });
        console.log(`ITERATION START --- Iteration: ${iterationIndex}, Loaded Count: ${items.length}`);
        // There is no more data to load, we download the rest of the images and finish
        if (items.length === 0) {
            return;
        }
        await handleIterationFunction({ data: items, iterationInput, iterationIndex, stats, originalInput });

        if (items.length < batchSize) {
            return;
        }

        iterationIndex++;
    }
};

export const checkIfAlreadyOnS3 = async (key: any, uploadOptionsPassed: any) => {
    try {
        const data = await uploadOptionsPassed.s3Client.headObject({
            Key: key,
        }).promise();
        if (data.ContentLength > 0) {
            return { isThere: true, errors: [] };
        }
        return { isThere: false, errors: [] };
    } catch (e) {
        return { isThere: false, errors: [(e as Error).message] };
    }
};