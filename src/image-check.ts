import imageSize from 'image-size';
import mime from 'mime';
import { fileTypeFromBuffer, FileTypeResult } from 'file-type';
import { dwebp } from 'webp-converter';
import fs from 'fs';
import { promisify } from 'util';

const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);

const converter = (input: any, output: any, option: any) => new Promise((res, rej) => {
    dwebp(input, output, option, (status: any, err: any) => {
        if (status === '101') {
            rej(err);
        } else if (status === '100') {
            res(status);
        } else {
            rej(new Error(`Unknown status: ${status}, Error: ${err}`));
        }
    });
});

export const convertWebpToPng = async (origBuffer: any, key: any) => {
    // sanitize key for slashes
    const folders = key.split('/');
    const sanitizedKey = folders[folders.length - 1];
    const webpKey = `${sanitizedKey}.webp`;
    const pngKey = `${sanitizedKey}.png`;
    await writeFileAsync(webpKey, origBuffer);
    await converter(webpKey, pngKey, '-o');
    return readFileAsync(pngKey);
};

export const checkIfImage = async (response: any, imageCheck: any, url: string) => {
    const result: {
        isImage: boolean;
        error?: string;
        contentType?: string;
        sizes: any;
        retry: boolean;
    } = {
        isImage: false,
        error: undefined,
        contentType: undefined,
        sizes: {},
        retry: false,
    }
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

        const buffer: Buffer | string = response.body;

        if (imageCheck.type === 'content-type' || imageCheck.type === 'image-size') {
            /** Text based files (.svg) are detected by their URL path, while binary files are detected by their buffer */
            const isTextBasedFile = typeof buffer === 'string';

            if (isTextBasedFile) {
                const urlPath = new URL(url).pathname;
                result.contentType = mime.getType(urlPath) ?? undefined;
            } else {
                const { mime } = (await fileTypeFromBuffer(buffer)) as FileTypeResult;
                result.contentType = mime;
            }

            if (!result.contentType?.includes('image/')) {
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
            const imageBuffer = Buffer.from(buffer);
            const { width, height } = imageSize(imageBuffer);

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
