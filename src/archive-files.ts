import { KeyValueStore, log } from "crawlee";
import archiver from "archiver";
import { fileTypeFromBuffer, FileTypeResult } from "file-type";
import fs from "fs";

const archiveFilePath = `./archive.zip`;

export const archiveKVS = async (store: KeyValueStore) => {
    let archive = archiver('zip', {
        zlib: { level: 9 }
    });

    archive.on('error', (err) => {
        throw err;
    });

    const output: any = fs.createWriteStream(archiveFilePath);

    output.on('close', () => {
        log.info('Archive has been written');
    });

    archive.pipe(output);

    await store.forEachKey(async (key) => {
        const buffer = (await store.getValue(key)) as Buffer;
        const { ext } = await fileTypeFromBuffer(buffer) as FileTypeResult;

        archive.append(buffer, { name: `${key}.${ext}` });
    });

    await archive.finalize();

    return fs.createReadStream(archiveFilePath);
}

export const deleteArchiveFile = async () => {
    try {
        fs.unlinkSync(archiveFilePath);
    } catch (err) {
        log.error(`Error while deleting archive file ${(err as Error).message}`);
    }
}
