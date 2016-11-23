const generateBMFont = require('msdf-bmfont');
const fs = require('fs');

generateBMFont('arial.ttf', (error, textures, font) => {
    "use strict"
    if (error) throw error;
    textures.forEach((sheet, index) => {
        font.pages.push(`sheet${index}.png`);
        fs.writeFile(`sheet${index}.png`, sheet, (err) => {
            if (err) throw err;
        });
    });
    fs.writeFile('font.json', JSON.stringify(font), (err) => {
        if (err) throw err;
    });
});