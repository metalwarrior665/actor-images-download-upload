module.exports.checkInput = (input) => {
    if (!input.uploadTo) throw new Error('INPUT.uploadTo has to be specified!');

    if (input.uploadTo === 's3' && (!input.s3Bucket || !input.s3AccessKeyId || !input.s3SecretAccessKey)) {
        throw new Error('If you want to upload to S3, you have to provide all of s3Bucket, s3AccessKeyId and s3SecretAccessKey in input!');
    }

    if (!input.inputId) {
        throw new Error('There is no input id to get image URLs from!');
    }

    if (typeof input.fileNameFunction === 'string') {
        try {
            input.fileNameFunction = eval(input.fileNameFunction);
        } catch (e) {
            throw new Error('fileName function cannot be evaluated as a function. Error:', e.message);
        }
    }

    if (typeof input.preDownloadFunction === 'string') {
        try {
            input.fileNameFunction = eval(input.fileNameFunction);
        } catch (e) {
            throw new Error('preDownloadFunction function cannot be evaluated as a function. Error:', e.message);
        }
    }

    if (typeof input.postDownloadFunction === 'string') {
        try {
            input.fileNameFunction = eval(input.fileNameFunction);
        } catch (e) {
            throw new Error('postDownloadFunction function cannot be evaluated as a function. Error:', e.message);
        }
    }

    if (!input.pathToImageUrls) {
        console.log('Path to image Urls not specified, will assume that input is plain image Urls array');
    }
    return input;
};
