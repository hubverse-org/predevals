const path = require('path');

module.exports = {
    experiments: {
        outputModule: true,
    },
    mode: 'production',
    entry: [ // order is crucial
        './src/predevals.js',
    ],
    output: {
        filename: 'predevals.bundle.js',
        path: path.resolve(__dirname, 'dist'),
        library: {
            type: 'module',  // apparently experimental
        },
        clean: true,
    },
};
