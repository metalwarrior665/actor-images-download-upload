const Jimp = require('jimp');
const fileType = require('file-type');

const rp = require('request-fixed-tunnel-agent');
const Apify = require('apify');

const URL = 'https://www.manor.ch/productimages/P5-58202201_01_626218_jpg_zoom1000.jpg';

const jimp = async (buffer) => {

    const metadata = await Jimp.read(buffer);
    const { width, height } = metadata.bitmap;

    if (width && height) return true;
};

const filetype = async (buffer) => {
    const { mime } = fileType(buffer);
    return mime;
};

Apify.main(async () => {
    const buffer = await rp({
        url: URL,
        encoding: null,
    });

    console.log('buffer length', buffer.length);

    const jimpStart = Date.now();
    console.log(await jimp(buffer));
    console.log(`Jimp took: ${Date.now() - jimpStart} ms`)

    const filetypeStart = Date.now();
    console.log(await filetype(buffer));
    console.log(`fileType took: ${Date.now() - filetypeStart} ms`)
});
