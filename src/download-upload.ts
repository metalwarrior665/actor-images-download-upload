import { Actor, log } from 'apify';
import needle from 'needle';
import { HttpsProxyAgent } from 'hpagent';

import { checkIfImage, convertWebpToPng } from './image-check.js';
import { ImageCheck } from './types.js';

const deduplicateErrors = (errors: any) => {
    return errors.reduce((newErrors: any, error: any) => {
        const maybeFoundDup = newErrors.find((er: any) => er.when === error.when && er.message === error.message);
        if (maybeFoundDup) {
            return newErrors;
        }
        return newErrors.concat(error);
    }, []);
};

const upload = async (key: string, buffer: any, uploadOptions: any, contentType: any) => {
    const errors: string[] = [];
    if (uploadOptions.uploadTo === 'key-value-store' || uploadOptions.uploadTo === 'zip-file') {
        if (uploadOptions.storeHandle) {
            await uploadOptions.storeHandle.setValue(key, buffer, { contentType })
                .catch((e: Error) => {
                    errors.push(e.message);
                });
        } else {
            await Actor.setValue(key, buffer, { contentType })
                .catch((e: Error) => {
                    errors.push(e.message);
                });
        }
    }
    if (uploadOptions.uploadTo === 's3') {
        await uploadOptions.s3Client.putObject({
            Key: key,
            Body: buffer,
        }).promise().catch((e: Error) => {
            errors.push(e.message);
        });
    }
    if (errors.length > 0) {
        return {
            imageUploaded: false,
            errors,
        };
    }
    return {
        imageUploaded: true,
        errors,
    };
};

const download = async (url: string, imageCheck: ImageCheck, key: string, downloadOptions: any) => {
    const { downloadTimeout, maxRetries, proxyConfiguration } = downloadOptions;

    const proxyUrl = proxyConfiguration && proxyConfiguration.useApifyProxy
        ? await (await Actor.createProxyConfiguration(proxyConfiguration))!.newUrl()
        : null;
    const proxyAgent = proxyUrl ? new HttpsProxyAgent({ proxy: proxyUrl! }) : null;

    const errors: string[] = [];
    let imageDownloaded = false;
    let response: any;
    let contentTypeMain;
    let sizesMain;

    const handleError = (e: Error) => {
        log.debug(`Error downloading image:`, e);
        errors.push(e.toString());
    };

    const sendRequest = async () => {
        return Promise.race([
            needle("get", url, {
                agent: proxyAgent,
                setEncoding: null,
                follow_max: 5,
            }).catch(err => {
                throw new Error(err);
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out')), downloadTimeout)),
        ]).catch(handleError);
    };

    let timeDownloading = 0;
    let timeProcessing = 0;

    while (!imageDownloaded && errors.length <= maxRetries) {
        const startDownloading = Date.now();
        response = await sendRequest();
        timeDownloading += Date.now() - startDownloading;
        if (!response) continue;

        const startProcessing = Date.now();

        const isRedirect = [301, 302].includes(response.statusCode);
        const imageUrl = isRedirect ? response.headers.location : url;

        const { isImage, error, retry, contentType, sizes } = await checkIfImage(response, imageCheck, imageUrl);
        sizesMain = sizes;
        timeProcessing += Date.now() - startProcessing;

        if (!isImage && error) {
            errors.push(error);
        } else {
            imageDownloaded = true;
            contentTypeMain = contentType;
        }

        if (!retry) break;
    }

    const retryCount = errors.length;

    // converting to other mime
    if (imageDownloaded && contentTypeMain === 'image/webp' && imageCheck.convertWebpToPng) {
        const startProcessing = Date.now();
        try {
            response.body = await convertWebpToPng(response.body, key);
        } catch (e) {
            imageDownloaded = false;
            errors.push(`Error in converting: ${e}`);
        }
        timeProcessing += Date.now() - startProcessing;
    }

    return {
        response,
        errors,
        retryCount,
        imageDownloaded,
        timeDownloading,
        timeProcessing,
        sizes: sizesMain,
        contentType: contentTypeMain,
    };
};

export const downloadUpload = async (url: string, key: string, downloadUploadOptions: any, imageCheck: ImageCheck) => {
    const { downloadOptions, uploadOptions } = downloadUploadOptions;
    const errors: any[] = [];
    const time = {
        downloading: 0,
        processing: 0,
        uploading: 0,
    };
    let imageUploaded = false;

    if (!url.includes('http://') && !url.includes('https://')) {
        return {
            imageUploaded,
            errors: [{ when: 'before-download', error: 'url does not contain http or https' }],
            time,
        };
    }

    const {
        retryCount,
        contentType,
        response,
        errors: downloadErrors,
        imageDownloaded,
        timeDownloading,
        timeProcessing,
        sizes,
    } = await download(url, imageCheck, key, downloadOptions);

    time.downloading = timeDownloading;
    time.processing = timeProcessing;

    if (imageDownloaded) {
        const startUploading = Date.now();
        const uploadResult = await upload(key, response.body, uploadOptions, contentType);
        time.uploading += (Date.now() - startUploading);

        ({ imageUploaded } = uploadResult);
        uploadResult.errors.forEach((error) => {
            errors.push({ when: 'upload', message: error });
        });
    }
    downloadErrors.forEach((error) => {
        errors.push({ when: 'download', message: error });
    });
    const infoObject: any = {
        imageUploaded,
    };
    if (!imageCheck.noInfo) {
        infoObject.errors = deduplicateErrors(errors);
        infoObject.retryCount = retryCount;
        infoObject.contentType = contentType;
        infoObject.sizes = sizes;
        infoObject.time = time;
    }
    return infoObject;
};
