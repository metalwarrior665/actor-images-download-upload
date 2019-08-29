## images-download-upload

This is detailed documentation of the actor. If you rather want a quick-start with a real example, read this blog post tutorial(article coming very soon!).

- [Overview](#overview)
- [Changelog](#Changelog)
- [Usage](#usage)
- [Input](#input)
- [Data and image paths](#data-and-image-paths)
- [Input functions](#input-functions)
- [Internals](#internals)
- [Webhooks](#webhooks)

## Overview

**images-download-upload** is an [Apify actor](https://www.apify.com/docs/actor) that can be used to to download and upload any number of images from any data that include image URLs. It can load from [Apify datasets](https://www.apify.com/docs/storage#dataset),[Apify key value stores](https://apify.com/docs/storage#key-value-store) or [crawler executions](https://www.apify.com/docs/crawler). It can be run both on Apify platform or locally. It is built with [Apify SDK](https://sdk.apify.com/) and [request](https://www.npmjs.com/package/request) npm package.

## Changelog

#### Version-2
- Removed `continueRunId` from input. Use [actor resurrect](https://apify.com/docs/actor#run-resurrect) feature instead.
- `batchSize` can have now arbitrary size. Previously it was limited to max dataset load (250,000).
- Removed `maxItems`. You can use `predownloadFunction` to manipulate input data.
- Added `stateFields` for a possibility to clean log and decrease memory usage of big batches.
- Added `duplicatesIndexes` to state object for abillity to track duplicates.

## Limits
- It is better to split downloading of more than 200k images into more runs due to memory constrains.
- Keep in mind that if you don't have enough proxies, some websites can block you fairly quickly (even though images aren't usually that protected)

## Usage

If you want to run the actor on **Apify platform** you need to open the [actor's page in the library](https://apify.com/lukaskrivka/images-download-upload) and then click on `Try actor` which will will create new [task](https://apify.com/docs/tasks) in your account or you can directly start it using our API. When using public actors, you don't need to build them since everything is done by the author. You only need to provide an input and then you can run them. But keep in mind that usage is always charged towards the one who runs the actor. You can also let it run in [schedules](https://apify.com/docs/scheduler) or called by a webhook.

If on the other side you want to run the actor **locally**, you need to open the actor's [github page](https://github.com/metalwarrior665/actor-images-download-upload) and clone it to your computer. See [Apify CLI](https://github.com/apifytech/apify-cli) how to run it locally.

## Input

Most of Apify actors require a JSON input and this one is no exception. The input consists of one object with multiple options:

- **`options`**<[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)>
    - `inputId` <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Apify ID of the storage where the data are located. Can be ID of a dataset, key-value store or crawler execution. Key-value-store requires to set also a `recordKey` **Required**
    - `recordKey` <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Only fill if your `inputId` points to a key-value-store. It is the record key under which the data are saved.
    - `pathToImageUrls` <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Path from the item to the array of image URLs or single image URL string. `""` means the data are array of image URLs, `detail/images` means it will search for images under this nested property. Look at [Data and image paths](#data-and-image-paths) **Default**: `""` (root array).
    - `uploadTo` <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Can be one of `no-upload`, `key-value-store` or `s3`. **Default**: `key-value-store`.
    - `outputTo` <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Useful when you want to transform the data as you download images. Can be one one `no-output`, `key-value-store` or `dataset`.  **Default**: `dataset`.
    - `fileNameFunction`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Stringified function. It return how the image file will be named. See [Input functions](#input-functions)
    - `preDownloadFunction`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Stringified function. It can help you prepare the data for the image download. For example you can mark some items to not be downloaded. See [Input functions](#input-functions)
    - `postDownloadFunction`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Stringified function. It can help you process the data after the image download. For example you can remove item where images were not downloaded(failed for any reason). See [Input functions](#input-functions)
    - `maxItems`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> You can limit the number of items to be downloaded from. Useful for testing. **Default**: It downloads everything
    - `concurrency`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> You can limit the number of parallel downloads. Useful when the target website is blocking.  **Default**: It scales to maximum that your memory/CPU can handle.
    - `convertWebpToPng`: <[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type)> If true, It will automatically convert all images in webp format to png. Be careful that settings in to `true` will significantly increase the size of the image files. **Default**: `false`.
    - `imageCheckMaxRetries`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Maximum number of retries if the image download fails. Doesn't retry on `404` or too small images.
    - `imageCheckType`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> You can set a checker of image quality and size. `none` downloads everything, `content-type` checks if the file has image-like content-type and - `image-size`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> allows you to check if the image is big enough. **Default**: `content-type`.
    - `imageCheckMinSize`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Minimal size of the image in KBs. Smaller images are not downloaded. Only useful if `image-size` is set to `image-size`.
    - `imageCheckMinWidth`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Minimal width of the image in pixels. Smaller images are not downloaded. Only useful if `image-size` is set to `image-size`.
    - `imageCheckMinHeight`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Minimal height of the image in pixels. Smaller images are not downloaded. Only useful if `image-size` is set to `image-size`.
    - `s3Bucket`:<[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Name of the S3 bucket where you want to upload the image files. You need to set `uploadTo` to `s3`.
    - `s3AccessKeyId`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Your S3 access key id. You need to set `uploadTo` to `s3`.
    - `s3SecretAccessKey`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Your S3 secret access key. You need to set `uploadTo` to `s3`.
    - `s3CheckIfAlreadyThere`: <[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type)> If set to `true` it will check your S3 bucket if the image file is already there before uploading. Reading is much cheaper than writing so this is useful to save money if you do a lot of reuploads. **Default**: `false`.
    - `statsFields`: <[array](https://developer.mozilla.org/cs/docs/Web/JavaScript/Reference/Global_Objects/Array)> Array of stats fields you want to be present in the state object. Useful if you want cleaner log or less memory usage.

## Data and image paths
The data where the image URLs are located needs to be saved on [Apify storage](https://apify.com/docs/storage) either in [key-value store](https://apify.com/docs/storage#key-value-store) or [dataset](https://apify.com/docs/storage#dataset). If you don't have the data already there, you can simply upload them with a single API call for key-value store or dataset.

Data provided should be an array (which is always the case for datasets) and the images can be located anywhere in the nested objects, it should just be consistent over all items. The `pathToImageUrls` uses [object-path](https://www.npmjs.com/package/object-path) library to locate the images, it can point either to a single image URL or an array of image URLs.

**Few examples**:

Data can be just a plain array of image URLs. In this case you don't need to fill `pathToImageUrls` at all.

```
[
    "https://n.nordstrommedia.com/id/cf6c6151-4380-44aa-ad73-85e4b2140383.jpeg",
    "https://n.nordstrommedia.com/id/6c03833f-c5f1-43d8-9d20-fb29834c7798.jpeg"
]
```

If you scrape some e-commerce website, you will usually have items that have the images inside. In this example `pathToImageUrls` would be `images`.

```
[{

  "title": "wide sleeved blouse",
  "price": 790,
  "url": "https://www.farfetch.com/shopping/women/rosetta-getty-wide-sleeved-blouse-item-12997948.aspx",
  "images": [
    "https://cdn-images.farfetch-contents.com/12/99/79/48/12997948_13710943_1000.jpg",
    "https://cdn-images.farfetch-contents.com/12/99/79/48/12997948_13710944_1000.jpg",
    "https://cdn-images.farfetch-contents.com/12/99/79/48/12997948_13710945_1000.jpg",
  ]
},
{
  "title": "Nagoya jumpsuit",
  "price": 996,
  "url": "https://www.farfetch.com/shopping/women/le-kasha-nagoya-jumpsuit-item-12534697.aspx",
  "images": [
    "https://cdn-images.farfetch-contents.com/12/53/46/97/12534697_11885527_1000.jpg",
    "https://cdn-images.farfetch-contents.com/12/53/46/97/12534697_11885539_1000.jpg",
    "https://cdn-images.farfetch-contents.com/12/53/46/97/12534697_11885553_1000.jpg",
  ]
}
]
```

Image URLs can be also deeply nested. In this case it is also just single URL instead of an array. `pathToImageUrls` will be `images.0.src`

```
[{
  "retailer": "walmart",
  "url": "https://www.walmart.com/ip/Pull-On-Treggings/462482210",
  "title": "Pull-On Treggings",
  "retailPrice": 40,
  "images": [
    {
      "src": "https://i5.walmartimages.com/asr/88dcf47d-052b-4a06-815f-82c071ca2e50_1.ea5c31e512197ac22b3c7e7c1959aa84.jpeg?odnHeight=450&odnWidth=450&odnBg=FFFFFF"
    }
  ]
}]
```

## Input functions

For more advanced data preparation and post-processing, you can use any of the 3 input functions. Let's look at each of them and their use-cases.

### fileNameFunction
`fileNameFunction` is the only one of the three that is always executed and has it's default form. It basically names each image file no matter where it is stored.

It receives these arguments which you can (but not need to) use:
, md5, index, itemOfImage
- `url`<[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> URL of the image.
- `md5` <[function](https://www.npmjs.com/package/md5)> Simple function that takes a string and produces a hash.
- `index` <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Index of the image in the download process. Each image has unique index.
- `itemOfImage` <[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)> The item object where the image URL is located.
- `iterationIndex` <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Index of the current iteration(batch). Look at [internals](#internals) for more info. Starts at 0.

By default `fileNameFunction` simply produces a hash of the image URL:
```(url, md5, index, itemOfImage) => md5(url)```
So your image file would be named something like `78e731027d8fd50ed642340b7c9a63b3`.

**Example use-cases**:
*Create folder on S3 and simply add index numbers as filenames*
```(url, md5, index, itemOfImage) => `images/${index}` ```

*More complicated filename that depends on other atributes of the item*
```(url, md5, index, itemOfImage) => `${item.retailer}_${item.retailerProductId}_${item.color}.jpg` ```

### preDownloadFunction
`preDownloadFunction` is useful when you need to process the data before downloading them. You can get rid of items that are corrupted or not interesting.

It receives only the `inputData` argument which is the data as loaded from the `inputId`.

**skipDownload**
If you add `skipDownload: true` property to any item, its images won't be downloaded. The data will stay as they are.

**Example use-cases**:
*Do not download images of items that are not new*
```
(inputData) => inputData.map((item) => {
    if (item.status !== 'NEW) {
        item.skipDownload = true;
    }
    return item;
})
```

### postDownloadFunction
`postDownloadFunction` allows you to change the data after the downloading process finished. Its main advantage is that you know if the images were properly downloaded.

It receives these arguments which you can (but not need to) use:
- `data` <[array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)> The data that you get from `inputId` or pass in `preDownloadFunction` if you specified it.
- `imagesObject` <[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)> State object that has image URLs of the current batch as keys and their info as values. Look [below](#internals) for more details about state object.
- `fileNameFunction` <[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions)> Filename function that you specified or its default implementation.
- `md5` <[function](https://www.npmjs.com/package/md5)> Simple function that takes a string and produces a hash.
- `iterationIndex` <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Index of the current iteration(batch). Look at [internals](#internals) for more info. Starts at 0.

**Example use-cases**:
*Remove all image URLs that were not properly downloaded/uploaded. If the item has no downloaded/uploaded image, remove it completely. The download can be hard blocked by the website (even after multiple retries) but it can also fail the test you can configure, e.g. the image is too small*
```
 (data, imagesObject, fileNameFunction, md5) => {
    // we map over all the items
    return data.reduce((newData, item) => {
        // We filter only the downloaded/uploaded
        const downloadedImages = item.images.filter((imageUrl) => {
                return imagesObject[imageUrl] && imagesObject[imageUrl].imageUploaded;
            });

        // If there are no downloaded image, we remove the item from the data
        if (downloadedImages.length === 0) {
            return newData;
        }

        // At the end we will assign only properly downloaded/uploaded images and pass the item to our processed data.
        return newData.concat({ ...item, images: downloadedImages });
    }, []);
}
```

## Internals
The actor processes the `inputData` in batches to lower memory needs. The default batch size is 10000 items. Each batch has its own data and state and the data are fully processed before the next batch starts to get processed.

The state is an object which keys are image URLs. It's values depend on if the image URLs was processed or not. Initially the images are loaded just with indexes like this:
```
{
  "https://images-na.ssl-images-amazon.com/images/I/716chGzGflL._UL1500_.jpg": {
    "itemIndex": 328,
    "imageIndex": 1982
  },
  "https://images-na.ssl-images-amazon.com/images/I/81ySn0IS0zL._UL1500_.jpg": {
    "itemIndex": 328,
    "imageIndex": 1983
  },
  "https://images-na.ssl-images-amazon.com/images/I/71plznRyJ9L._UL1500_.jpg": {
    "itemIndex": 328,
    "imageIndex": 1984
  }
}
```

## Webhooks
Currently Actor webhooks don't allow to pass custom input so this actor cannot be called by a webhook (This feature should be available very soon).

For now you should call this actor using [Apify.call()](https://sdk.apify.com/docs/api/apify#module_Apify.call) or create a task and then call the task with [Apify.callTask()](https://sdk.apify.com/docs/api/apify#module_Apify.callTask)(This is prefered option). If you want to call this from a Web Scraper or other public actor that doesn't allow you to modify its source code, you have to create an intermediate actor that will serve the correct input.

You can read about the whole workflow and integration in my blog post. (Add link)



