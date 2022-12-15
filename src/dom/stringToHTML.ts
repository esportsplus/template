export default (html: string) => {
    let template = document.createElement('template');

    template.innerHTML = html;

    return template.content;
};
