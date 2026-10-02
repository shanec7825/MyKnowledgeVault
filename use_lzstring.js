const LZString = require('lz-string');
const input = process.argv[2];
const result = LZString.decompressFromBase64(input);
if (result) {
    console.log(result);
} else {
    console.error('Failed to decompress');
    process.exit(1);
}
