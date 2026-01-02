import path from 'path';
import ts from 'typescript';


let cachedProgram: ts.Program | null = null,
    cachedRoot: string | null = null;


function createProgram(root: string): ts.Program {
    let configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json');

    if (!configPath) {
        throw new Error('tsconfig.json not found');
    }

    let configFile = ts.readConfigFile(configPath, ts.sys.readFile);

    if (configFile.error) {
        throw new Error(`Error reading tsconfig.json: ${configFile.error.messageText}`);
    }

    let parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(configPath)
    );

    if (parsedConfig.errors.length > 0) {
        throw new Error(`Error parsing tsconfig.json: ${parsedConfig.errors[0].messageText}`);
    }

    return ts.createProgram({
        options: parsedConfig.options,
        rootNames: parsedConfig.fileNames
    });
}


const getProgram = (root: string): ts.Program => {
    if (!cachedProgram || cachedRoot !== root) {
        cachedProgram = createProgram(root);
        cachedRoot = root;
    }

    return cachedProgram;
}

const invalidateProgram = (): void => {
    cachedProgram = null;
    cachedRoot = null;
}


export { getProgram, invalidateProgram };
