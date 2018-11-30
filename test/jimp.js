const Jimp = require('jimp');
const rp = require('request-fixed-tunnel-agent');
const Apify = require('apify');

const URL = 'https://www.manor.ch/productimages/P5-58202201_01_626218_jpg_zoom1000.jpg';

const isImage = async (url) => {
    const resp = await rp({
        url,
        encoding: null,
    });
    const metadata = await Jimp.read(resp);
    const { width, height } = metadata.bitmap;
    console.log('width:', width);
    console.log('height:', height);

    if (width && height) return true;
};

Apify.main(async () => {
    const check = await isImage(URL);
    console.log(check);
});
