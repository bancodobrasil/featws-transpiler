#!/usr/bin/env node

const { linter } = require('../src/linter');

(async () => {
    try {
        const errors = await linter(process.cwd());
        if (errors.length > 0) {
            errors.forEach(e => console.error(e));
            process.exit(1);
        }
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})()