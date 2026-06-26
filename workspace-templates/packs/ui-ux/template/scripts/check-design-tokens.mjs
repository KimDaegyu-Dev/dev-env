#!/usr/bin/env node

import fs from "node:fs";

const file = "tokens/design-tokens.json";
JSON.parse(fs.readFileSync(file, "utf8"));
console.log(`Design tokens OK: ${file}`);
