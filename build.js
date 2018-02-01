#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const execSync = require('child_process').execSync;

const PROJECT = 'left-undetected';
const VERSION = '0.5';

const CONTAINER_FILE = 'docs/index.html';
const OUTPUT_FILE = `dist/${PROJECT}/index.html`;
const README_FILE = 'README.md';
const LICENSE_FILE = 'LICENSE';
const IMPORT_PATTERN = /^IMPORT\s+\S+/;
const ARCHIVE_NAME = `${PROJECT}-${VERSION}.zip`;

console.log('Assembling Bitsy HTML file...');

build(CONTAINER_FILE, OUTPUT_FILE)
  .then(() => {
    // Update output dir with current readme and license.
    try {
      const outputPath = path.dirname(OUTPUT_FILE);
      mkPathSync(outputPath);
      fs.copyFileSync(README_FILE, path.join(outputPath, path.basename(README_FILE)));
      fs.copyFileSync(LICENSE_FILE, path.join(outputPath, path.basename(LICENSE_FILE)));
    } catch(e) {
      console.log(e);
    }

    console.log(`Zipping ${ARCHIVE_NAME}...`);
    process.chdir('dist');
    execSync(`zip -r ${ARCHIVE_NAME} ${PROJECT}`, { stdio: 'inherit' });
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

// Interprets IMPORT statement in Bitsy `containerFile` and replaces it with
// game data from the referenced data file, outputting to `outputFile`.
function build(containerFile, outputFile) {
  const containerFilePath = path.dirname(containerFile);
  let containerText;

  return readFile(containerFile)
    .then(contents => containerText = contents)
    .then(() => {
      // Given "IMPORT <file>", extract "<file>" and read it from disk.
      const lines = containerText.split(/\n/);
      const importStatement = lines.find(line => line.match(IMPORT_PATTERN));
      const importParts = importStatement.split(/\s+/);
      const dataFile = importParts.slice(1).join(' ');
      return readFile(path.join(containerFilePath, dataFile));
    })
    .then(dataText => {
      const combinedText = inject(containerText, dataText, IMPORT_PATTERN);
      return writeFile(outputFile, combinedText);
    });
}

// Looks for a line that matches `dividerPattern` in `containerText`, replaces
// it with `injectionText`.
function inject(containerText, injectionText, dividerPattern) {
  const lines = containerText.split(/\n/);
  const [firstHalf, secondHalf] = partition(lines, dividerPattern);
  return firstHalf.concat(injectionText).concat(secondHalf).join('\n');
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    fs.readFile(path.join(process.cwd(), file), (err, contents) => {
      if (err) return reject(err);
      resolve(contents.toString());
    });
  });
}

function writeFile(file, contents) {
  return new Promise((resolve, reject) => {
    fs.writeFile(path.join(process.cwd(), file), contents, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

// Splits the `list` at the item that matches `dividerPattern` and returns the
// set of items before it and the set of items after it in an array of two
// arrays.
function partition(list, dividerPattern) {
  let divided = false;
  return list.reduce((parts, item) => {
    if (divided) {
      parts[1].push(item);
    } else if (item.match(dividerPattern)) {
      divided = true;
    } else {
      parts[0].push(item);
    }
    return parts;
  }, [[], []]);
}

function mkPathSync(targetPath) {
  try {
    const pathParts = targetPath.split(path.sep);
    for (let i = 0; i < pathParts.length; i++) {
      fs.mkdirSync(path.join(...pathParts.slice(0, i+1)));
    }
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
}
