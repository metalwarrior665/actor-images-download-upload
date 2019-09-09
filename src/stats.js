module.exports.Stats = class Stats {
    constructor(statsState) {
        if (!statsState) {
            this.itemsTotal = 0;
            this.itemsSkipped = 0;
            this.imagesTotal = 0;
            this.imagesAlreadyOnS3 = 0;
            this.imagesUploaded = 0;
            this.imagesFailed = 0;
            this.imagesDuplicates = 0;
            this.imagesNoFilename = 0;
            this.imagesNotString = 0;
            this.itemsWithoutImages = 0;
            this.timeSpentDownloading = 0;
            this.timeSpentProcessing = 0;
            this.timeSpentUploading = 0;
            this.failedInfo = [];
        } else {
            Object.keys(statsState).forEach((key) => {
                this[key] = statsState[key];
            });
        }
    }

    inc(prop, updateStats) {
        if (!updateStats) return;
        if (this[prop] == null) {
            throw new Error(`Property ${prop} is not initiated in the Stats class so it cannot be incremented!`);
        }
        this[prop]++;
    }

    add(prop, count, updateStats) {
        if (!updateStats) return;
        if (this[prop] == null) {
            throw new Error(`Property ${prop} is not initiated in the Stats class so it cannot be incremented!`);
        }
        this[prop] += count;
    }

    set(prop, val, updateStats) {
        if (!updateStats) return;
        if (this[prop] == null) {
            throw new Error(`Property ${prop} is not initiated in the Stats class so it cannot be incremented!`);
        }
        this[prop] = val;
    }

    addFailed(failedObject) {
        if (typeof failedObject !== 'object' || failedObject.url === undefined || !failedObject.errors) { // add other later
            console.dir(failedObject);
            throw new Error('Argument to "addFailed" of Stat class must be object with url and errors properties!');
        }
        this.failedInfo.push(failedObject);
    }

    return() {
        const statsKeys = Object.keys(this);
        const statsObject = {};
        for (const key of statsKeys) {
            statsObject[key] = this[key];
        }
        return statsObject;
    }

    display() {
        const statsObject = this.return();
        delete statsObject.failedInfo;
        console.log('*** STATS ***');
        console.dir(statsObject);
    }

    getProps() {
        return {
            itemsTotal: 'itemsTotal',
            itemsSkipped: 'itemsSkipped',
            imagesTotal: 'imagesTotal',
            imagesAlreadyOnS3: 'imagesAlreadyOnS3',
            imagesUploaded: 'imagesUploaded',
            imagesFailed: 'imagesFailed',
            imagesDuplicates: 'imagesDuplicates',
            imagesNoFilename: 'imagesNoFilename',
            itemsWithoutImages: 'itemsWithoutImages',
            imagesNotString: 'imagesNotString',
            timeSpentDownloading: 'timeSpentDownloading',
            timeSpentProcessing: 'timeSpentProcessing',
            timeSpentUploading: 'timeSpentUploading',
            failedInfo: 'failedInfo',
        };
    }
};
