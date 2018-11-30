module.exports.defaultFileNameFunction = (url, md5) => {
    return md5(url);
};

module.exports.defaultPostDownloadFunction = (data, imagesObject, fileNameFunction, md5) => {
    console.log(Object.keys(imagesObject).length)
    return data.map((item) => {
        const newImages = !item.images ? [] : item.images.map((imageUrl) => {
            if (imagesObject[imageUrl] && imagesObject[imageUrl].imageUploaded){
                return{
                    sourceUrl: imageUrl,
                    fileUrl: fileNameFunction(imageUrl, md5),
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
