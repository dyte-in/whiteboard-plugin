import axios from "axios";

interface DebounceObj {
    'onPageChange'?: {
        cb: any,
        timeout: NodeJS.Timeout,
    }
}

const debounceObj: DebounceObj = {};

const debounce = (cb: any, delay: number) => {
    return (...args: any) => {
        const obj = debounceObj['onPageChange'];
        if (!obj) {
            debounceObj['onPageChange'] = {
                cb,
                timeout: setTimeout(function() {
                    cb(...args);
                }, delay)
            }
        }
        if (obj) {
            obj.cb = cb;
            clearTimeout(obj.timeout);
            obj.timeout = setTimeout(function () {
                cb(...args);
            }, delay)
        }
    }
}

const throttle = (cb: any, delay: number) => {
    let previousCall = new Date().getTime();
    return function(...args: any) {
        const time = new Date().getTime();
        if (time - previousCall >= delay) {
            previousCall = time;
            cb(...args);
        }
    }
}

const getFormData = (file: Blob, fileName: string) => {
    const formData = new FormData();
    formData.append("file", file, fileName);
    return {formData, fileName: fileName };
}

const fetchUrl = async (formData: FormData, authToken: string) => {
    try {
        const result = await axios({
            method: "post",
            url: `${import.meta.env.VITE_API_BASE}/file`,
            data: formData,
            headers: {"Authorization": `Bearer ${authToken}`},
        });
        if(result?.data?.link)
        {
            return `${import.meta.env.VITE_API_BASE}/file/${result.data.link}`;
        }
    } catch (e: any) {
       throw new Error(e.code);
    }
}

const randomColor = () => {
    var color = Math.floor(Math.random()*16777215).toString(16);
    return '#' + color;
}

export { randomColor, debounce, throttle, getFormData, fetchUrl };
