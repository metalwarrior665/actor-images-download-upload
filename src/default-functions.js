module.exports.defaultFileNameFunction = ({ url, md5 }) => {
    return md5(url);
};

