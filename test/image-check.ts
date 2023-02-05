import { Actor } from 'apify';
import Jimp from "jimp";
import { fileTypeFromFile, FileTypeResult } from 'file-type';
import sizeOf from 'image-size';
import rp from 'request-fixed-tunnel-agent';

const URL = 'https://www.manor.ch/productimages/P5-58202201_01_626218_jpg_zoom1000.jpg';

const jimpFn = async (buffer) => {
    const metadata = await Jimp.read(buffer);
    const { width, height } = metadata.bitmap;

    if (width && height) return true;
};

const filetypeFn = async (buffer) => {
    const { mime } = await fileTypeFromFile(buffer) as FileTypeResult;
    return mime;
};

const sizeOfFn = async (buffer) => {
    console.dir(sizeOf(buffer));
};

await Actor.init();
const buffer = await rp({
    url: URL,
    encoding: null,
});

console.log('buffer length', buffer.length);

const jimpStart = Date.now();
console.log(await jimpFn(buffer));
console.log(`Jimp took: ${Date.now() - jimpStart} ms`);

const filetypeStart = Date.now();
console.log(await filetypeFn(buffer));
console.log(`fileType took: ${Date.now() - filetypeStart} ms`);

const sizeOfStart = Date.now();
await sizeOfFn(buffer);
console.log(`sizeOfStart took: ${Date.now() - sizeOfStart} ms`);

await Actor.exit();
