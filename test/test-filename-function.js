module.exports.testFilenameFunction = (url, md5, index, item) => {
    return `${item.local_image_path}-${index}`;
};
