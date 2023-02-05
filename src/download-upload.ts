import { Actor } from 'apify';
import rp from 'request-fixed-tunnel-agent';

import { checkIfImage, convertWebpToPng } from './image-check.js';

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
    if (uploadOptions.uploadTo === 'key-value-store') {
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

const download = async (url: string, imageCheck: any, key: string, downloadOptions: any) => {
    const { downloadTimeout, maxRetries, proxyConfiguration } = downloadOptions;

    const proxyUrl = proxyConfiguration && proxyConfiguration.useApifyProxy
        ? (await Actor.createProxyConfiguration(proxyConfiguration))!.newUrl()
        : null;
    const normalOptions = {
        strictSSL: false,
        url,
        encoding: null,
        resolveWithFullResponse: true,
    };
    const proxyOptions = {
        ...normalOptions,
        proxy: proxyUrl,
    };

    const errors: string[] = [];
    let imageDownloaded = false;
    let response;
    let contentTypeMain;
    let sizesMain;

    const handleError = (e: Error) => {
        errors.push(e.toString());
    };

    const sendRequest = async (options: any) => {
        return Promise.race([
            rp(options),
            // httpRequest(httpReqOptions),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeouted')), downloadTimeout)),
        ]).catch(handleError);
    };

    let timeDownloading = 0;
    let timeProcessing = 0;

    while (!imageDownloaded && errors.length <= maxRetries) {
        const startDownloading = Date.now();
        if (proxyUrl) {
            response = await sendRequest(proxyOptions);
        } else {
            response = await sendRequest(normalOptions);
        }
        timeDownloading += Date.now() - startDownloading;
        if (!response) continue;

        const startProcessing = Date.now();
        const { isImage, error, retry, contentType, sizes } = await checkIfImage(response, imageCheck);
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

export const downloadUpload = async (url: string, key: string, downloadUploadOptions: any, imageCheck: any) => {
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