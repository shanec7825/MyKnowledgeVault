const fs = require('fs');

function decompressFromBase64(input) {
    if (input == null) return "";
    if (input == "") return null;
    
    var keyStrBase64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var baseReverseDic = {};
    
    function getBaseValue(alphabet, character) {
        if (!baseReverseDic[alphabet]) {
            baseReverseDic[alphabet] = {};
            for (var i = 0; i < alphabet.length; i++) {
                baseReverseDic[alphabet][alphabet.charAt(i)] = i;
            }
        }
        return baseReverseDic[alphabet][character];
    }
    
    function _decompress(length, resetValue, getNextValue) {
        var dictionary = [];
        var enlargeIn = 4;
        var dictSize = 4;
        var numBits = 3;
        var entry = "";
        var result = [];
        var i, w, bits, resb, maxpower, power, c;
        var data = { val: getNextValue(0), position: resetValue, index: 1 };

        for (i = 0; i < 3; i += 1) {
            dictionary[i] = i;
        }

        bits = 0;
        maxpower = Math.pow(2, 2);
        power = 1;
        while (power != maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
                data.position = resetValue;
                data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
        }

        switch (bits) {
            case 0:
                bits = 0;
                maxpower = Math.pow(2, 8);
                power = 1;
                while (power != maxpower) {
                    resb = data.val & data.position;
                    data.position >>= 1;
                    if (data.position == 0) {
                        data.position = resetValue;
                        data.val = getNextValue(data.index++);
                    }
                    bits |= (resb > 0 ? 1 : 0) * power;
                    power <<= 1;
                }
                c = String.fromCharCode(bits);
                break;
            case 1:
                bits = 0;
                maxpower = Math.pow(2, 16);
                power = 1;
                while (power != maxpower) {
                    resb = data.val & data.position;
                    data.position >>= 1;
                    if (data.position == 0) {
                        data.position = resetValue;
                        data.val = getNextValue(data.index++);
                    }
                    bits |= (resb > 0 ? 1 : 0) * power;
                    power <<= 1;
                }
                c = String.fromCharCode(bits);
                break;
            case 2:
                return "";
        }

        dictionary[3] = c;
        w = c;
        result.push(c);

        while (true) {
            if (data.index > length) {
                return "";
            }

            bits = 0;
            maxpower = Math.pow(2, numBits);
            power = 1;
            while (power != maxpower) {
                resb = data.val & data.position;
                data.position >>= 1;
                if (data.position == 0) {
                    data.position = resetValue;
                    data.val = getNextValue(data.index++);
                }
                bits |= (resb > 0 ? 1 : 0) * power;
                power <<= 1;
            }

            switch (c = bits) {
                case 0:
                    bits = 0;
                    maxpower = Math.pow(2, 8);
                    power = 1;
                    while (power != maxpower) {
                        resb = data.val & data.position;
                        data.position >>= 1;
                        if (data.position == 0) {
                            data.position = resetValue;
                            data.val = getNextValue(data.index++);
                        }
                        bits |= (resb > 0 ? 1 : 0) * power;
                        power <<= 1;
                    }
                    dictionary[dictSize++] = String.fromCharCode(bits);
                    c = dictSize - 1;
                    enlargeIn--;
                    break;
                case 1:
                    bits = 0;
                    maxpower = Math.pow(2, 16);
                    power = 1;
                    while (power != maxpower) {
                        resb = data.val & data.position;
                        data.position >>= 1;
                        if (data.position == 0) {
                            data.position = resetValue;
                            data.val = getNextValue(data.index++);
                        }
                        bits |= (resb > 0 ? 1 : 0) * power;
                        power <<= 1;
                    }
                    dictionary[dictSize++] = String.fromCharCode(bits);
                    c = dictSize - 1;
                    enlargeIn--;
                    break;
                case 2:
                    return result.join('');
            }

            if (enlargeIn == 0) {
                enlargeIn = Math.pow(2, numBits);
                numBits++;
            }

            if (dictionary[c]) {
                entry = dictionary[c];
            } else {
                if (c === dictSize) {
                    entry = w + w.charAt(0);
                } else {
                    return null;
                }
            }

            result.push(entry);
            dictionary[dictSize++] = w + entry.charAt(0);
            enlargeIn--;
            w = entry;

            if (enlargeIn == 0) {
                enlargeIn = Math.pow(2, numBits);
                numBits++;
            }
        }
    }
    
    return _decompress(input.length, 32, function(index) {
        return getBaseValue(keyStrBase64, input.charAt(index));
    });
}

const files = [
    'Excalidraw/Drawing 2026-08-05 18.37.12.excalidraw.md',
    'Excalidraw/Drawing 2026-08-07 17.40.20.excalidraw.md',
    'Excalidraw/Drawing 2026-08-07 17.41.23.excalidraw.md',
    'Excalidraw/Drawing 2026-08-07 17.43.20.excalidraw.md',
    'Excalidraw/Drawing 2026-08-08 17.22.57.excalidraw.md',
    'Excalidraw/Drawing 2026-08-16 15.14.55.excalidraw.md',
    'Excalidraw/Drawing 2026-09-14 07.58.07.excalidraw.md',
    'Excalidraw/Drawing 2026-09-14 08.29.21.excalidraw.md',
    'Excalidraw/Drawing 2026-09-14 08.29.50.excalidraw.md',
    'Excalidraw/Drawing 2026-09-15 16.44.11.excalidraw.md',
    'Excalidraw/Drawing 2026-09-20 15.22.08.excalidraw.md'
];

for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const regex = new RegExp('```compressed-json\\s+([\\s\\S]+?)\\s+```');
    const match = content.match(regex);
    
    if (match) {
        const base64 = match[1].trim();
        const jsonStr = decompressFromBase64(base64);
        
        if (jsonStr) {
            try {
                const data = JSON.parse(jsonStr);
                const texts = [];
                
                if (data.elements) {
                    for (const el of data.elements) {
                        if (el.type === 'text' && el.text) {
                            texts.push(el.text);
                        }
                    }
                }
                
                console.log(`\n=== ${file.split('/').pop()} ===`);
                console.log(`Total elements: ${data.elements ? data.elements.length : 0}`);
                
                if (texts.length > 0) {
                    console.log(`\nText content (${texts.length} text boxes):`);
                    texts.forEach((t, i) => {
                        const display = t.replace(/\n/g, ' ⏎ ');
                        console.log(`  ${i + 1}. ${display}`);
                    });
                } else {
                    console.log('No text elements');
                }
            } catch (e) {
                console.log(`\n=== ${file.split('/').pop()} ===`);
                console.log(`Error parsing JSON: ${e.message}`);
            }
        } else {
            console.log(`\n=== ${file.split('/').pop()} ===`);
            console.log('Decompression failed');
        }
    }
}
