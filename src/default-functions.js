const md5 = require('md5');

module.exports.defaultFileNameFunction = (url) => {
    return md5(url);
};

module.exports.defaultPostDownloadFunction = (data, imagesObject, fileNameFunction) => {
    return data.map((item) => {
        const newImages = item.images.map((imageUrl) => {
            if (imagesObject[imageUrl].imageUploaded){
                return{
                    sourceUrl: imageUrl,
                    fileUrl: fileNameFunction(imageUrl),
                }
            } else {
                return{
                    sourceUrl: imageUrl,
                    errors: imagesObject[imageUrl].errors,
                }
            }
        });
        return { ...item, images: newImages };
    });
};
