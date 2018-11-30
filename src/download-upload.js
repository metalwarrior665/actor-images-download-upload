const Apify = require('apify');
const rp = require('request-fixed-tunnel-agent');

const { PROXY_URL } = require('./constants');
const { checkIfImage } = require('./utils');

const upload = async (key, buffer, uploadOptions) => {
    const errors = [];
    if (uploadOptions.uploadTo === 'key-value-store') {
        await Apify.setValue(key, buffer, { contentType: 'image/jpeg' })
            .catch((e) => {
                errors.push(e.message);
            });
    }
    if (uploadOptions.uploadTo === 's3') {
        await uploadOptions.s3Client.putObject({
            Key: key,
            Body: buffer,
        }).promise().catch((e) => {
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

const download = async (url) => {
    const normalOptions = {
        url,
        encoding: null,
        timeout: 25000,
    };
    const proxyOptions = {
        url,
        encoding: null,
        timeout: 25000,
        proxy: PROXY_URL,
    };
    let errorsCount = 0;
    const errors = [];
    let imageDownloaded = false;
    let response;

    const handleError = (e) => {
        errors.push(`${e.message}`);
    };

    const sendRequest = async (options) => {
        return Promise.race([
            rp(options),
            new Promise((resolve) => setTimeout(resolve, 30000)),
        ]).catch(handleError);
    };

    while (!imageDownloaded && errorsCount < 3) {
        if (errorsCount > 0) {
            response = await sendRequest(proxyOptions);
        } else {
            response = await sendRequest(normalOptions);
        }
        if (!response) {
            errorsCount++;
            continue;
        }
        const { isImage, error } = await checkIfImage(response);
        console.log('isImage', isImage);
        console.log('error', error);
        if (!isImage) {
            errorsCount++;
            errors.push({ message: error });
        } else {
            imageDownloaded = true;
        }
    }
    return {
        response,
        errors,
        imageDownloaded,
    };
};

module.exports.downloadUpload = async (url, key, uploadOptions) => {
    const errors = [];
    let imageUploaded = false;

    const { response: buffer, errors: downloadErrors, imageDownloaded } = await download(url);

    if (imageDownloaded) {
        const uploadResult = await upload(key, buffer, uploadOptions);

        ({ imageUploaded } = uploadResult);
        uploadResult.errors.forEach((error) => {
            errors.push({ when: 'upload', message: error.message });
        });
    }
    downloadErrors.forEach((error) => {
        errors.push({ when: 'download', message: error.message });
    });
    return {
        imageUploaded,
        errors,
    };
};
