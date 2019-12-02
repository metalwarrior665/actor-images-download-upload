#### Version-2 - 2019-12-02
- Input has been completely redesigned. Please read it again and adjust.
- Removed integration for cancelled Apify Crawler product.
- Added automatic integration with actor webhooks.
- Removed `continueRunId` from input. Use [actor resurrect](https://apify.com/docs/actor#run-resurrect) feature instead.
- `batchSize` can have now arbitrary size. Previously it was limited to max dataset load (250,000).
- Removed `maxItems`. You can use `predownloadFunction` to manipulate input data.
- Added `stateFields` for a possibility to clean log and decrease memory usage of big batches.
- Added `duplicatesIndexes` to state object for abillity to track duplicates.
