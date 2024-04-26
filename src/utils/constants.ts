const storeConf = {
    volatile: false,
}
let INDEX = 1;

const setIndex = (val: number) => {
    INDEX = val;
}

export {
    storeConf,
    INDEX,
    setIndex,
}