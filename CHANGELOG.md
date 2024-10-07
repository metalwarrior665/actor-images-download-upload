# 2024-05-10

- Added support for text based image files like SVG etc.
- Added support for redirecting to the actual image URL.

# 2023-03-13

- Add two new option `items` and `outputDatasetId` to input.

# 2023-02-07

- Rewrite to crawlee, and overall updates.
- Added a new option `zip-file` for `uploadTo` dropdown to upload a zip file of all the images to the dataset.
- Fixed issue with downloading images.

#### Version-2 - 2019-12-02

- Input has been completely redesigned. Please read it again and adjust.
- Removed integration for cancelled Apify Crawler product.
- Added automatic integration with actor webhooks.
- Removed `continueRunId` from input. Use [actor resurrect](https://apify.com/docs/actor#run-resurrect) feature instead.
- `batchSize` can have now arbitrary size. Previously it was limited to max dataset load (250,000).
- Removed `maxItems`. You can use `predownloadFunction` to manipulate input data.
- Added `stateFields` for a possibility to clean log and decrease memory usage of big batches.
- Added `duplicatesIndexes` to state object for abillity to track duplicates.
