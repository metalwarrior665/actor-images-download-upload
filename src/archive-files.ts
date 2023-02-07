import { KeyValueStore, log } from "crawlee";
import archiver from "archiver";
import { fileTypeFromBuffer, FileTypeResult } from "file-type";

export const archiveKVS = async (store: KeyValueStore) => {
    const buffers: any = [];

    await new Promise(async (resolve, reject) => {
        const archive = archiver("zip", {
            zlib: { level: 9 }, // Sets the compression level.
        });

        archive.on("data", (chunk) => {
            buffers.push(chunk);
        });

        archive.on("end", () => {
            resolve(true);
        });

        archive.on("error", (err) => {
            log.error("Error archiving file", err);
            reject(err);
        });

        await store.forEachKey(async (key) => {
            const buffer = (await store.getValue(key)) as Buffer;
            const { ext } = await fileTypeFromBuffer(buffer) as FileTypeResult;

            archive.append(buffer, { name: `${key}.${ext}` });
        });

        return await archive.finalize();
    });

    return Buffer.concat(buffers);
};
