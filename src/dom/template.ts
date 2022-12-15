import stringToHTML from './stringToHTML';


export default (html: string) => {
    let template = stringToHTML(html);

    return () => [...template.cloneNode(true).childNodes];
};
