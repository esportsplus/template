export default (html: string) => {
    let template = document.createElement('template');

    if (html) {
        template.innerHTML = html;
        template.normalize();
    }

    return () => {
        return Array.from(
            template.content.cloneNode(true).childNodes
        );
    };
};