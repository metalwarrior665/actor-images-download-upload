## images-download-upload

- [Overview](#overview)
- [Changelog](#Changelog)
- [Usage](#usage)
- [Input](#input)
- [Data and image paths](#data-and-image-paths)
- [Input functions](#input-functions)
- [State](#state)
- [Webhooks](#webhooks)

## Overview

**images-download-upload** is an [Apify actor](https://www.apify.com/docs/actor) that can be used to to download and upload any number of image files from any data that include image URLs. It can load from [Apify datasets](https://www.apify.com/docs/storage#dataset) or[Apify key value stores](https://apify.com/docs/storage#key-value-store). It can be run both on Apify platform or locally. It is built with [Apify SDK](https://sdk.apify.com/) and [request](https://www.npmjs.com/package/request) npm package.

## Changelog
Check [`CHANGELOG.md`](https://github.com/metalwarrior665/actor-images-download-upload/blob/master/CHANGELOG.md) for detailed information.

#### Version-2 - 2019-12-02

## Limits
- It is better to split downloading of more than 200k images into more runs due to memory constrains.
- Keep in mind that if you don't have enough proxies, some websites can block you fairly quickly (even though images aren't usually that protected)

## Usage

If you want to run the actor on **Apify platform** you need to open the [actor's page in the library](https://apify.com/lukaskrivka/images-download-upload) and then click on `Try for free` which will will create new [task](https://apify.com/docs/tasks) in your account or you can directly start it using our API. When using public actors, you don't need to build them since everything is done by the author. You only need to provide an input and then you can run them. But keep in mind that usage is always charged towards the one who runs the actor. You can also let it run in [schedules](https://apify.com/docs/scheduler) or called by a [webhook](#webhooks).

If on the other side you want to run the actor **locally**, you need to open the actor's [github page](https://github.com/metalwarrior665/actor-images-download-upload) and clone it to your computer. See [Apify CLI](https://github.com/apifytech/apify-cli) how to run it locally.

## Input

Most of Apify actors require a [JSON](https://www.w3schools.com/js/js_json_syntax.asp) input and this one is no exception. The input consists of one object with multiple options. For brevity the options here are split into categories but they all belong into one object.

**Main Options**:
- `datasetId`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Apify ID of the dataset where the data are located. **This or `storeInput` has to be provided**.
- `pathToImageUrls`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Path from the item to the array of image URLs or single image URL string. `""` means the data are array of image URLs, `detail/images` means it will search for images under this nested property. Look at [Data and image paths](#data-and-image-paths) **Default**: `""` (root array).
- `fileNameFunction`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Stringified function. It return how the image file will be named. See [Input functions](#input-functions).

**Input/Output options**:
- `limit`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Max items to load from the dataset. Use with `offset` to paginate over the data (can reduce memory requirement of large loads).
- `offset`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> How many items to skip from the dataset. Use with `limit` to paginate over the data (can reduce memory requirement of large loads).
- `outputTo`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Useful when you want to transform the data as you download images. Can be one one `no-output`, `key-value-store` or `dataset`.  **Default**: `dataset`.
- `storeInput`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> If you want to input the data from key-value store instead of dataset. Notation: `storeId-recordKey`, e.g. `kWdGzuXuKfYkrntWw-OUTPUT`.

**Image upload options**
- `uploadTo`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Where do you want to upload the image files. Valid options are: `key-value-store`, `s3` or `no-upload`.
- `uploadStoreName`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Fill this only if `uploadTo` is `key-value-store`. Key-value store name where the images will be upload. Empty field means it will be uploaded to the default key-value store.
- `s3Bucket`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Name of the S3 bucket where you want to upload the image files. You need to set `uploadTo` to `s3`.
- `s3AccessKeyId`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Your S3 access key id. You need to set `uploadTo` to `s3`.
- `s3SecretAccessKey`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Your S3 secret access key. You need to set `uploadTo` to `s3`.
- `s3CheckIfAlreadyThere`: <[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type)> If set to `true` it will check your S3 bucket if the image file is already there before uploading. Reading is much cheaper than writing so this is useful to save money if you do a lot of reuploads. **Default**: `false`.

**Transforming functions**
- `preDownloadFunction`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Stringified function. It can help you prepare the data for the image download. For example you can mark some items to not be downloaded. See [Input functions](#input-functions).
- `postDownloadFunction`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Stringified function. It can help you process the data after the image download. For example you can remove item where images were not downloaded(failed for any reason). See [Input functions](#input-functions).

**Image quality check options**
- `imageCheckMaxRetries`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Maximum number of retries if the image download fails. Doesn't retry on `404` or too small images.
- `imageCheckType`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> You can set a checker of image quality and size. `none` downloads everything, `content-type` checks if the file has image-like content-type and  `image-size`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> allows you to check if the image is big enough. **Default**: `content-type`.
- `imageCheckMinSize`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Minimal size of the image in KBs. Smaller images are not downloaded. Only useful if `image-size` is set to `image-size`.
- `imageCheckMinWidth`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Minimal width of the image in pixels. Smaller images are not downloaded. Only useful if `image-size` is set to `image-size`.
- `imageCheckMinHeight`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Minimal height of the image in pixels. Smaller images are not downloaded. Only useful if `image-size` is set to `image-size`.

**Miscellaneous options**
- `proxyConfiguration`: <[object](https://www.w3schools.com/js/js_objects.asp)> Select proxies to be used. **Default**: `{ "useApifyProxy": true }`.
- `maxConcurrency`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> You can limit the number of parallel downloads. Useful when the target website is blocking.  **Default**: It scales to maximum that your memory/CPU can handle.
`downloadTimeout`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> How long we will max wait to download each image in milliseconds. **Default**: `7000`.
`batchSize`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Number of items loaded from dataset in one batch. Each batch manages its own state. Useful to split for runs with hundreds of thousands images. **Default**: 10000.
- `convertWebpToPng`: <[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type)> If true, It will automatically convert all images in webp format to png. Be careful that settings in to `true` will significantly increase the size of the image files. **Default**: `false`.
- `stateFields`: <[array](https://developer.mozilla.org/cs/docs/Web/JavaScript/Reference/Global_Objects/Array)> Array of state fields you want to be present in the state object. Useful if you want cleaner log or less memory usage.
`noDownloadRun`: <[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type)> If true, the actor will not download and upload the images. Usefull for checking duplicates or transformations. **Default**: `false`.


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

It receives an object as argument with these properties which you can (but not need to) use. They should cover all use-cases for filename creation:

- `url`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> URL of the image.
- `md5`: <[function](https://www.npmjs.com/package/md5)> Simple function that takes a string and produces a hash.
- `state`: <[object](https://www.w3schools.com/js/js_objects.asp)> Reference to the entire [state](#state) object.
- `item`: <[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)> The item object where the image URL is located.
- `iterationIndex`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Index of the current iteration(batch). Look at [internals](#internals) for more info. Starts at 0.
- `input`: <[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)> Original input of the actor

By default `fileNameFunction` simply produces a hash of the image URL:
```({ url, md5 }) => md5(url)```
So your image file would be named something like `78e731027d8fd50ed642340b7c9a63b3`.

**Example use-cases**:
*Create folder on S3 and simply add index numbers as filenames*
```({ url, md5, state }) => `images/${state[url].imageIndex}` ```

*More complicated filename that depends on other atributes of the item*
```({ item }) => `${item.retailer}_${item.retailerProductId}_${item.color}.jpg` ```

### preDownloadFunction
`preDownloadFunction` is useful when you need to process the data before downloading them. You can get rid of items that are corrupted or not interesting.

It receives an object as argument with these properties which you can (but not need to) use:
- `data`: <[array](https://developer.mozilla.org/cs/docs/Web/JavaScript/Reference/Global_Objects/Array)> Initial data loaded from dataset or key value store you provided.
- `iterationIndex`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Index of the current iteration(batch). Look at [internals](#internals) for more info. Starts at 0.
- `input`: <[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)> Original input of the actor

**skipDownload**
If you add `skipDownload: true` property to any item, its images won't be downloaded. The data will stay as they are.

**Example use-cases**:
*Do not download images of items that are not new*
```
({ data }) => data.map((item) => {
    if (item.status !== 'NEW) {
        item.skipDownload = true;
    }
    return item;
})
```

### postDownloadFunction
`postDownloadFunction` allows you to change the data after the downloading process finished. Its main advantage is that you know if the images were properly downloaded.

It receives an object as argument with these properties which you can (but not need to) use:
- `data` <[array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)> The data that you get from your input or passed by `preDownloadFunction` if you specified it.
- `state` <[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)> State object that has image URLs of the current batch as keys and their info as values. Look [below](#state) for more details about state object.
- `fileNameFunction` <[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions)> Filename function that you specified or its default implementation.
- `md5` <[function](https://www.npmjs.com/package/md5)> Simple function that takes a string and produces a hash.
- `iterationIndex` <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Index of the current iteration(batch). Look at [internals](#internals) for more info. Starts at 0.
- `input`: <[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)> Original input of the actor

**Example use-cases**:
*Remove all image URLs that were not properly downloaded/uploaded. If the item has no downloaded/uploaded image, remove it completely. The download can be hard blocked by the website (even after multiple retries) but it can also fail the test you can configure, e.g. the image is too small*
```
 ({ data, state, fileNameFunction, md5 }) => {
    // we map over all the items
    return data.reduce((newData, item) => {
        // We filter only the downloaded/uploaded
        const downloadedImages = item.images.filter((imageUrl) => {
                return state[imageUrl] && state[imageUrl].imageUploaded;
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

## State
The actor processes the input data in batches to lower memory needs. The default batch size is 10000 items. Each batch has its own data and state and the data are fully processed before the next batch starts to get processed.

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

After download/upload the state has much richer information that you can use in `postDownloadFunction` to determine what to do next.

```
"https://i.ebayimg.com/images/g/FDgAAOSwJd1b5NKF/s-l1600.jpg": {
    "imageIndex": 0,
    "itemIndex": 0,
    "duplicateIndexes": [
      43,
      46,
      49
    ],
    "imageUploaded": true,
    "errors": [],
    "retryCount": 0,
    "contentType": "image/jpeg",
    "sizes": {
      "sizeInKB": 346
    },
    "time": {
      "downloading": 1959,
      "processing": 0,
      "uploading": 9
    }
  },
  ...
}
```

## Webhooks
Very often you want to run an image download/upload update after every run of your scraping/automation actor. [Webhooks](https://apify.com/docs/webhooks) are solution for this. The default `datasetId` will be passed automatically to the this actor's run so you don't need to set it up in the payload template (internally the actor transforms the `resource.defaultDatasetId` from the webhook into just `datasetId` for its own input).

The webhook from your scraping/automation run can either call the `Images Downalod & Upload` actor directly or as a task. If you call the **actor directly**, you have to fill up the payload template with appropriate input and add this as a URL:
`https://api.apify.com/v2/acts/lukaskrivka~google-spreadsheet/runs?token=<YOUR_API_TOKEN>`
Be aware that this is dangerous because if you don't specify exact version, yout integration will break after actor's author will update it. Use tasks for webhooks instead!

I strongly recommend to rather **create a task** with predefined input that will not change in every run - the only changing part is usually `datasetId`. You will not need to fill up the payload template and your webhook URL will then look like:
`https://api.apify.com/v2/actor-tasks/<YOUR-TASK-ID>/runs?token=<YOUR_API_TOKEN>`



