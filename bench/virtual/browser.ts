import { create } from './app';
import { format, run } from './harness';


const main = async () => {
    let container = document.createElement('div');

    document.body.appendChild(container);

    let app = create(container, true),
        virtual = await run(app);

    app.dispose();
    container.remove();
    container = document.createElement('div');
    document.body.appendChild(container);

    app = create(container, false);

    let baseline = await run(app);

    app.dispose();

    console.log('\n[virtual]\n\n' + format(virtual) + '\n');
    console.log('\n[baseline]\n\n' + format(baseline) + '\n');

    await fetch('/results', {
        body: JSON.stringify({ baseline, virtual }),
        method: 'POST'
    });
};

main();
