export type StatsState = {
    itemsTotal: number;
    itemsSkipped: number;
    imagesTotal: number;
    imagesAlreadyOnS3: number;
    imagesUploaded: number;
    imagesFailed: number;
    imagesDuplicates: number;
    imagesNoFilename: number;
    imagesNotString: number;
    itemsWithoutImages: number;
    timeSpentDownloading: number;
    timeSpentProcessing: number;
    timeSpentUploading: number;
    failedInfo: any[];
}

export class Stats {
    itemsTotal: number = 0;
    itemsSkipped: number = 0;
    imagesTotal: number = 0;
    imagesAlreadyOnS3: number = 0;
    imagesUploaded: number = 0;
    imagesFailed: number = 0;
    imagesDuplicates: number = 0;
    imagesNoFilename: number = 0;
    imagesNotString: number = 0;
    itemsWithoutImages: number = 0;
    timeSpentDownloading: number = 0;
    timeSpentProcessing: number = 0;
    timeSpentUploading: number = 0;
    failedInfo: any[] = [];

    constructor(statsState: StatsState) {
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
                this[key as keyof StatsState] = statsState[key as keyof StatsState] as any;
            });
        }
    }

    inc(prop: keyof Omit<StatsState, 'failedInfo'>, updateStats: boolean) {
        if (!updateStats) return;
        if (this[prop] == null) {
            throw new Error(`Property ${prop} is not initiated in the Stats class so it cannot be incremented!`);
        }
        this[prop]++;
    }

    add(prop: keyof Omit<StatsState, 'failedInfo'>, count: number, updateStats: boolean) {
        if (!updateStats) return;
        if (this[prop] == null) {
            throw new Error(`Property ${prop} is not initiated in the Stats class so it cannot be incremented!`);
        }
        this[prop] += count;
    }

    set(prop: keyof StatsState, val: any, updateStats: boolean) {
        if (!updateStats) return;
        if (this[prop] == null) {
            throw new Error(`Property ${prop} is not initiated in the Stats class so it cannot be incremented!`);
        }
        this[prop] = val;
    }

    addFailed(failedObject: any) {
        if (typeof failedObject !== 'object' || failedObject.url === undefined || !failedObject.errors) { // add other later
            console.dir(failedObject);
            throw new Error('Argument to "addFailed" of Stat class must be object with url and errors properties!');
        }
        this.failedInfo.push(failedObject);
    }

    return() {
        const statsKeys = Object.keys(this);
        const statsObject: any = {};
        for (const key of statsKeys) {
            statsObject[key] = this[key as keyof StatsState];
        }
        return statsObject;
    }

    display() {
        const statsObject: any = this.return();
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
        } as { [key in keyof StatsState]: key};
    }
};
