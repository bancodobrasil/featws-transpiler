#!/usr/bin/env node

const {compiler} = require('../index');

(async () => {
    try {
        await compiler(process.cwd());
    } catch (e) {
        console.error(e);
    }
})()