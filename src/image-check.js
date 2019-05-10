const imageSize = require('image-size');
const fileType = require('file-type');
const webp = require('webp-converter');
const fs = require('fs');
const { promisify } = require('util');

const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);

const converter = (input, output, option) => new Promise((res, rej) => {
    webp.dwebp(input, output, option, (status, err) => {
        if (status === '101') {
            rej(err);
        } else if (status === '100') {
            res(status);
        } else {
            rej(new Error(`Unknown status: ${status}, Error: ${err}`));
        }
    });
});

module.exports.convertWebpToPng = async (origBuffer, key) => {
    // sanitize key for slashes
    const folders = key.split('/');
    const sanitizedKey = folders[folders.length - 1];
    const webpKey = `${sanitizedKey}.webp`;
    const pngKey = `${sanitizedKey}.png`;
    await writeFileAsync(webpKey, origBuffer);
    await converter(webpKey, pngKey, '-o');
    return readFileAsync(pngKey);
};

module.exports.checkIfImage = async (response, imageCheck) => {
    const result = {
        isImage: false,
        error: undefined,
        contentType: undefined,
        sizes: {},
        retry: false,
    };
    try {
        if (!response) {
            result.error = 'No response object, probably crashed';
            return result;
        }

        const { statusCode } = response;

        if (statusCode >= 400) {
            result.error = statusCode;
            // On non-404 we retry
            if (statusCode !== 404) {
                result.retry = true;
            }
            return result;
        }

        const buffer = response.body;

        if (imageCheck.type === 'content-type' || imageCheck.type === 'image-size') {
            const { mime } = fileType(buffer);
            result.contentType = mime;
            if (!mime.includes('image/')) {
                result.error = `Content type is not an image. Instead: ${mime}`;
                // We also retry on bad content-type, this can mean captcha
                result.retry = true;
                return result;
            }
        }

        // first we check buffer size
        const imageSizeInKB = Math.floor(buffer.length / 1024);
        result.sizes.sizeInKB = imageSizeInKB;
        if (imageSizeInKB < imageCheck.minSize) {
            result.error = `Image is too small. Actual size: ${imageSizeInKB}, min size: ${imageCheck.minSize}`;
            return result;
        }

        if (imageCheck.type === 'image-size') {
            const { width, height } = imageSize(buffer);
            result.sizes.width = width;
            result.sizes.height = height;
            if (width < imageCheck.minWidth || height < imageCheck.minHeight) {
                result.error = `Image width or height is too small. Actual: width: ${width}, height: ${height}. Minimum: width: ${imageCheck.minWidth}, height: ${imageCheck.minHeight} `;  // eslint-disable-line
                return result;
            }
        }

        // If we got here, the image is good
        result.isImage = true;
        return result;
    } catch (e) {
        result.error = `Image check crashed. Error: ${e}`;
        return result;
    }
};
