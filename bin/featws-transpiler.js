#!/usr/bin/env node

const { compiler } = require('../src/compiler');

(async () => {
    try {
        await compiler(process.cwd());
    } catch (e) {
        console.error(e);
    }
})()