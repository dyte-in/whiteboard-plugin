import { TldrawApp } from "@tldraw/tldraw";
import axios from "axios";

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

export { randomColor, throttle, getFormData, fetchUrl };
