import { KeyValueStore } from "crawlee";
import archiver from "archiver";

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
            console.log("End called");
            resolve(true);
        });

        archive.on("error", reject);

        await store.forEachKey(async (key, index, info) => {
            const val = (await store.getValue(key)) as Buffer;
            const split = key.split("-");
            archive.append(val, { name: `${split[0]}.${split[1]}` });
        });

        archive.finalize();
    });
    return Buffer.concat(buffers);
};
