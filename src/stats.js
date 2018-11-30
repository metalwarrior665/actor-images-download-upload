module.exports.Stats = class Stats {
    constructor() {
        this.inputDataCount = 0;
        this.imagesTotal = 0;
        this.imagesAlreadyOnS3 = 0;
        this.imagesUploaded = 0;
        this.imagesFailed = 0;
        this.duplicates = 0;
        this.failedInfo = [];
    }

    inc(prop) {
        if (this[prop] == null) {
            throw new Error(`Property ${prop} is not initiated in the Stats class so it cannot be incremented!`);
        }
        this[prop]++;
    }

    set(prop, val) {
        if (this[prop] == null) {
            throw new Error(`Property ${prop} is not initiated in the Stats class so it cannot be incremented!`);
        }
        this[prop] = val;
    }

    addFailed(failedObject) {
        if (typeof faileObject !== 'object' || !failedObject.url || !failedObject.errors) { // add other later
            throw new Error('Argument to "addFailed" of Stat class must be object with url and error properties!');
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
        console.log('*** STATS ***');
        console.dir(statsObject);
    }

    getProps() {
        return {
            inputDataCount: 'inputDataCount',
            imagesTotal: 'imagesTotal',
            imagesAlreadyOnS3: 'imagesAlreadyOnS3',
            imagesUploaded: 'imagesUploaded',
            imagesFailed: 'imagesFailed',
            imagesDuplicates: 'imagesDuplicates',
            failedInfo: 'failedInfo',
        };
    }
};
