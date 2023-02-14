import { Actor, log } from 'apify';
import Jimp from "jimp";
import { fileTypeFromBuffer, FileTypeResult } from 'file-type';
import sizeOf from 'image-size';
import rp from 'request-fixed-tunnel-agent';

const URL = 'https://www.manor.ch/productimages/P5-58202201_01_626218_jpg_zoom1000.jpg';

const jimpFn = async (buffer) => {
    const metadata = await Jimp.read(buffer);
    const { width, height } = metadata.bitmap;

    if (width && height) return true;
};

const filetypeFn = async (buffer) => {
    const { mime } = await fileTypeFromBuffer(buffer) as FileTypeResult;
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

log.info('buffer length', buffer.length);

const jimpStart = Date.now();
log.info(`${await jimpFn(buffer) || false}`);
log.info(`Jimp took: ${Date.now() - jimpStart} ms`);

const filetypeStart = Date.now();
log.info(await filetypeFn(buffer));
log.info(`fileType took: ${Date.now() - filetypeStart} ms`);

const sizeOfStart = Date.now();
await sizeOfFn(buffer);
log.info(`sizeOfStart took: ${Date.now() - sizeOfStart} ms`);

await Actor.exit();
