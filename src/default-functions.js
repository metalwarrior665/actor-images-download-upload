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

const ahmedFunction = (data, imagesObject, fileNameFunction, md5) => {
    return data.reduce((newData, item) => {
        if (!Array.isArray(item.images) || item.images.length === 0) {
            return newData;
        }
        const downloadedImages = item.images.filter((imageUrl) => {
            return imagesObject[imageUrl] && imagesObject[imageUrl].imageUploaded;
        });
        if (downloadedImages.length === 0) {
            return newData;
        }
        const newItem = { ...item, images: downloadedImages };
        return newData.concat(item);
    }, []);
}
