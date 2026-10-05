/** Asset URLs must follow the deployment subdirectory, including GitHub Pages. */
export function assetUrl(path:string){return `${import.meta.env.BASE_URL}${path.replace(/^\//,'')}`;}
