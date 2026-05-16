// This script generates a mapping of file extensions to icon names
// using a curated list based on material-icon-theme icons
// Avoiding direct import of material-icon-theme to prevent TS issues

import fs from "node:fs";
import path from "node:path";

// Curated mapping of common extensions to material-icon-theme icon names
const extensionToIcon: Record<string, string> = {
    // Programming languages
    ts: "typescript",
    tsx: "react_ts",
    js: "javascript",
    jsx: "react",
    py: "python",
    pyw: "python",
    rs: "rust",
    go: "go",
    java: "java",
    c: "c",
    cpp: "cpp",
    cc: "cpp",
    h: "c",
    hpp: "cpp",
    rb: "ruby",
    rbw: "ruby",
    php: "php",
    php3: "php",
    php4: "php",
    php5: "php",
    html: "html",
    htm: "html",
    css: "css",
    scss: "sass",
    sass: "sass",
    less: "less",
    // Data formats
    json: "json",
    jsonc: "json",
    json5: "json",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    // Documentation
    md: "markdown",
    mdx: "markdown",
    rst: "markdown",
    txt: "text",
    // Shell
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    fish: "shell",
    bat: "bat",
    cmd: "bat",
    ps1: "powershell",
    // Database
    sql: "database",
    // Config files
    gitignore: "git",
    env: "environment",
    dockerignore: "docker",
    dockerfile: "docker",
    // Images
    png: "image",
    jpg: "image",
    jpeg: "image",
    gif: "image",
    svg: "image",
    ico: "image",
    // Default
    _default: "file",
};

// Write to src/utils/iconMap.json
const outputPath = path.resolve("src/utils/iconMap.json");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(extensionToIcon, null, 2));

console.log(
    `Generated icon map with ${Object.keys(extensionToIcon).length} entries`,
);
console.log("Output:", outputPath);
