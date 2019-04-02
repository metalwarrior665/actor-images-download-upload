## images-download-upload

Documentation will be available very soon. This actor is still rapidly improving but functional.

- [Overview](#overview)
- [Changelog](#Changelog)
- [Usage](#usage)
- [Input](#input)
- [Data and image paths](#data-and-image-paths)
- [Input functions](#input-functions)
- [Webhooks](#webhooks)

## Overview

**images-download-upload** is an [Apify actor](https://www.apify.com/docs/actor) that can be used to to download and upload any number of images from any data that include image URLs. It can load from [Apify datasets](https://www.apify.com/docs/storage#dataset),[Apify key value stores](https://apify.com/docs/storage#key-value-store) or [crawler executions](https://www.apify.com/docs/crawler). It can be run both on Apify platform or locally. It is built with [Apify SDK](https://sdk.apify.com/) and [request](https://www.npmjs.com/package/request) npm package.

## Changelog

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
    `postDownloadFunction`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Stringified function. It can help you process the data after the image download. For example you can remove item where images were not downloaded(failed for any reason). See [Input functions](#input-functions)
    `maxItems`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> You can limit the number of items to be downloaded from. Useful for testing. **Default**: It downloads everything
    `concurrency`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> You can limit the number of parallel downloads. Useful when the target website is blocking.  **Default**: It scales to maximum that your memory/CPU can handle.
    `convertWebpToPng`: <[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type)> If true, It will automatically convert all images in webp format to png. Be careful that settings in to `true` will significantly increase the size of the image files. **Default**: `false`.
    `imageCheckMaxRetries`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Maximum number of retries if the image download fails. Doesn't retry on `404` or too small images.
    `imageCheckType`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> You can set a checker of image quality and size. `none` downloads everything, `content-type` checks if the file has image-like content-type and `image-size`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> allows you to check if the image is big enough. **Default**: `content-type`.
    `imageCheckMinSize`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Minimal size of the image in KBs. Smaller images are not downloaded. Only useful if `image-size` is set to `image-size`.
    `imageCheckMinWidth`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Minimal width of the image in pixels. Smaller images are not downloaded. Only useful if `image-size` is set to `image-size`.
    `imageCheckMinHeight`: <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Minimal height of the image in pixels. Smaller images are not downloaded. Only useful if `image-size` is set to `image-size`.
    `s3Bucket`:<[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Name of the S3 bucket where you want to upload the image files. You need to set `uploadTo` to `s3`.
    `s3AccessKeyId`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Your S3 access key id. You need to set `uploadTo` to `s3`.
    `s3SecretAccessKey`: <[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type)> Your S3 secret access key. You need to set `uploadTo` to `s3`.
    `s3CheckIfAlreadyThere`: <[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type)> If set to `true` it will check your S3 bucket if the image file is already there before uploading. Reading is much cheaper than writing so this is useful to save money if you do a lot of reuploads. **Default**: `false`.

## Data and image paths
The data where the image URLs are located needs to be saved on [Apify storage](https://apify.com/docs/storage) either in [key-value store](https://apify.com/docs/storage#key-value-store) or [dataset](https://apify.com/docs/storage#dataset). If you don't have the data already there, you can simply upload them with a single API call for key-value store or dataset.

## Input functions

## Webhooks




