const md5 = require('md5');

module.exports.defaultFileNameFunction = (url) => {
    return md5(url);
};

module.exports.defaultPostDownloadFunction = (data, imagesObject, fileNameFunction) => {
    console.log(Object.keys(imagesObject).length)
    return data.map((item) => {
        const newImages = item.images.map((imageUrl) => {
            if (imagesObject[imageUrl] && imagesObject[imageUrl].imageUploaded){
                return{
                    sourceUrl: imageUrl,
                    fileUrl: fileNameFunction(imageUrl),
                }
            } else if (imagesObject[imageUrl]) {
                return{
                    sourceUrl: imageUrl,
                    errors: imagesObject[imageUrl].errors,
                }
            } else {
                return imageUrl
            }
        });
        return { ...item, images: newImages };
    });
};
