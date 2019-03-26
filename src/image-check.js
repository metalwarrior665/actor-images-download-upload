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
    try {
        if (!response) {
            return {
                isImage: false,
                error: 'No response object, probably crashed',
                retry: false,
            };
        }

        const { statusCode } = response;

        if (statusCode === 404) {
            return {
                isImage: false,
                error: statusCode,
                retry: false,
            };
        }
        if (statusCode >= 400) {
            return {
                isImage: false,
                error: statusCode,
                retry: true,
            };
        }

        const buffer = response.body;
        let contentType;

        if (imageCheck.type === 'content-type' || imageCheck.type === 'image-size') {
            const { mime } = fileType(buffer);
            contentType = mime;
            if (!mime.includes('image/')) {
                return {
                    isImage: false,
                    error: `Content type is not an image. Instead: ${mime}`,
                    retry: true,
                };
            }
        }

        // first we check buffer size
        const imageSizeInKB = Math.floor(buffer.length / 1024);
        if (imageSizeInKB < imageCheck.minSize) {
            return {
                isImage: false,
                error: `Image is too small. Actual size: ${imageSizeInKB}, min size: ${imageCheck.minSize}`,
                retry: false,
            };
        }

        if (imageCheck.type === 'image-size') {
            const { width, height } = imageSize(buffer);
            if (width < imageCheck.minWidth || height < imageCheck.minHeight) {
                return {
                    isImage: false,
                    error: `Image width or height is too small. Actual: width: ${width}, height: ${height}. Minimum: width: ${imageCheck.minWidth}, height: ${imageCheck.minHeight} `,  // eslint-disable-line
                    retry: false,
                };
            }
            if (imageCheck.propagateSizes) {
                return {
                    isImage: true,
                    error: null,
                    contentType,
                    sizes: {
                        width,
                        height,
                    },
                };
            }
        }
        return {
            isImage: true,
            error: null,
            contentType,
        };
    } catch (e) {
        return {
            isImage: false,
            error: `Image check crashed. Error: ${e}`,
            retry: false,
        };
    }
};
